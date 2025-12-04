import {
  call,
  put,
  takeEvery,
  takeLatest,
  take,
  select,
  fork,
  delay,
  cancelled,
  all,
  cancel,
} from "redux-saga/effects";
import { eventChannel, type EventChannel, type Task } from "redux-saga";
import type {
  Group,
  NearbyGroupsRequest,
  NearbyGroupsResponse,
} from "@/shared/domain/group";
import {
  discoverNearbyGroups,
  createGroup as createGroupService,
  getDeviceCreatedGroup,
  getGroup,
  updateGroupName as updateGroupNameService,
  suggestGroupNameAndType,
} from "@/features/groups/services/group-service";
import {
  addFavorite,
  removeFavorite,
  isFavorited,
} from "@/features/groups/services/favorite-service";
import { getGroupStatusSummary } from "@/features/status/services/status-service";
import {
  getLatestMessage,
  getUnreadCount,
} from "@/features/messages/services/message-service";
import { getDatabase } from "@/shared/services/db";
import { pullDocuments } from "@/features/replication/services/replication-sync";
import { selectDevice } from "@/features/device/store/slice";
import {
  selectDeviceLocation,
  selectSelectedRadius,
} from "@/features/navigation/store/appSlice";
import { getToken } from "@/features/device/services/device-storage";
import type { RootState } from "@/store";
import {
  setNearbyGroups,
  setNearbyGroupsLoading,
  setNearbyGroupsError,
  setNearbyGroupsDistances,
  setGroup,
  setGroupLoading,
  setGroupError,
  addFavoriteGroup,
  removeFavoriteGroup,
  setLastFetchParams,
  setDeviceCreatedGroup,
  setGroupSuggestion,
  setGroupSuggestionLoading,
  setGroupSuggestionError,
  setGroupStatusSummary,
  setGroupDetails,
} from "./slice";
import { log } from "@/shared/lib/logging/logger";

// Action types
const FETCH_NEARBY_GROUPS = "groups/fetchNearbyGroups";
const PULL_GROUPS_REPLICATION = "groups/pullGroupsReplication";
const CREATE_GROUP = "groups/createGroup";
const FETCH_GROUP_DETAILS = "groups/fetchGroupDetails";
const TOGGLE_FAVORITE = "groups/toggleFavorite";
const CHECK_DEVICE_CREATED_GROUP = "groups/checkDeviceCreatedGroup";
const START_GROUP_STATUS_SUMMARY = "groups/startStatusSummary";
const STOP_GROUP_STATUS_SUMMARY = "groups/stopStatusSummary";
const FETCH_GROUPS_DETAILS = "groups/fetchGroupsDetails";
const UPDATE_GROUP_NAME = "groups/updateGroupName";
const SUGGEST_GROUP = "groups/suggestGroup";

// Action creators
export const fetchNearbyGroupsAction = (request: NearbyGroupsRequest) => ({
  type: FETCH_NEARBY_GROUPS,
  payload: request,
});
export const pullGroupsReplicationAction = (location?: {
  latitude: number;
  longitude: number;
  radius: number;
}) => ({
  type: PULL_GROUPS_REPLICATION,
  payload: location,
});
export const createGroupAction = (group: {
  name: string;
  type: Group["type"];
  latitude: number;
  longitude: number;
  region_code?: string;
}) => ({
  type: CREATE_GROUP,
  payload: group,
});
export const fetchGroupDetailsAction = (groupId: string) => ({
  type: FETCH_GROUP_DETAILS,
  payload: groupId,
});
export const toggleFavoriteAction = (groupId: string) => ({
  type: TOGGLE_FAVORITE,
  payload: groupId,
});
export const checkDeviceCreatedGroupAction = () => ({
  type: CHECK_DEVICE_CREATED_GROUP,
});
export const startGroupStatusSummaryAction = (groupId: string) => ({
  type: START_GROUP_STATUS_SUMMARY,
  payload: { groupId },
});
export const stopGroupStatusSummaryAction = (groupId: string) => ({
  type: STOP_GROUP_STATUS_SUMMARY,
  payload: { groupId },
});
export const fetchGroupsDetailsAction = (groupIds: string[] = []) => ({
  type: FETCH_GROUPS_DETAILS,
  payload: groupIds,
});
export const updateGroupNameAction = (groupId: string, name: string) => ({
  type: UPDATE_GROUP_NAME,
  payload: { groupId, name },
});
export const suggestGroupAction = (latitude: number, longitude: number) => ({
  type: SUGGEST_GROUP,
  payload: { latitude, longitude },
});

// Sagas
/**
 * Watch for fetch nearby groups actions
 * Uses takeLatest to cancel previous requests when new location is provided
 * This prevents duplicate API calls when location changes rapidly
 */
function* watchFetchNearbyGroups() {
  yield takeLatest(FETCH_NEARBY_GROUPS, handleFetchNearbyGroups);
}

// Track replication pull state to prevent duplicate calls
let isPullingGroups = false;
let lastPullTime = 0;
const PULL_DEBOUNCE_MS = 2000; // Minimum 2 seconds between pulls

function* watchPullGroupsReplication() {
  yield takeEvery(PULL_GROUPS_REPLICATION, handlePullGroupsReplication);
}

/**
 * Background task: pull groups replication mỗi 30s (nếu online & có token)
 * Ưu tiên dùng deviceLocation + radius hiện tại nếu có
 */
function* watchPeriodicGroupsReplication() {
  while (true) {
    // Chờ 30s giữa mỗi lần pull
    yield delay(30000);

    try {
      const token = getToken();
      if (!token) {
        continue;
      }

      // Lấy deviceLocation + radius đang chọn (nếu có) để pull groups phù hợp
      const deviceLocation = (yield select(
        (state: RootState) => state.app.deviceLocation
      )) as unknown as { latitude: number; longitude: number } | null;

      const radius = (yield select((state: RootState) =>
        selectSelectedRadius(state as RootState)
      )) as unknown as number;

      const locationPayload =
        deviceLocation && radius
          ? {
              latitude: deviceLocation.latitude,
              longitude: deviceLocation.longitude,
              radius,
            }
          : undefined;

      // Dùng cùng logic pull như action thủ công để tránh duplicate code
      yield call(handlePullGroupsReplication, {
        type: PULL_GROUPS_REPLICATION,
        payload: locationPayload,
      });
    } catch (error) {
      log.error("Periodic groups replication pull failed", error);
    }
  }
}

function* handlePullGroupsReplication(action: {
  type: string;
  payload?: { latitude: number; longitude: number; radius: number };
}) {
  // Check if device is registered (has token) before pulling replication
  const token = getToken();
  if (!token) {
    log.debug(
      "Skipping groups replication pull: Device not registered (no token)"
    );
    return;
  }

  const now = Date.now();

  // Debounce: Skip if pull was called recently or is in progress
  if (isPullingGroups || now - lastPullTime < PULL_DEBOUNCE_MS) {
    log.debug("Skipping duplicate groups replication pull", {
      isPullingGroups,
      timeSinceLastPull: now - lastPullTime,
    });
    return;
  }

  isPullingGroups = true;
  lastPullTime = now;

  try {
    log.debug("Pulling groups from replication", {
      hasLocation: !!action.payload,
    });
    // Trigger replication pull for groups collection
    // If location is provided, API will filter nearby groups
    // This will update RxDB, which triggers the Groups RxDB listener to update Redux
    yield call(pullDocuments, ["groups"], undefined, action.payload);
    log.debug("Groups replication pull completed");

    // Small delay to ensure RxDB has been updated with pulled groups
    yield delay(200);

    // After pulling groups, filter and update nearbyGroups array
    // This ensures useNearbyGroups hook returns the filtered groups
    // Note: RxDB listener will also trigger fetchNearbyGroupsAction, but this ensures it happens immediately
    if (action.payload) {
      yield put(
        fetchNearbyGroupsAction({
          latitude: action.payload.latitude,
          longitude: action.payload.longitude,
          radius: action.payload.radius,
        })
      );
      log.debug("Dispatched fetchNearbyGroupsAction after pull replication");
    }
  } catch (error) {
    log.error("Failed to pull groups from replication", error);
  } finally {
    isPullingGroups = false;
  }
}

function* handleFetchNearbyGroups(action: {
  type: string;
  payload: NearbyGroupsRequest;
}) {
  // Check if device is registered (has token) before pulling replication
  const token = getToken();
  if (!token) {
    log.debug("Skipping fetch nearby groups: Device not registered (no token)");
    yield put(setNearbyGroupsLoading(false));
    yield put(setNearbyGroups([]));
    return;
  }

  try {
    yield put(setNearbyGroupsLoading(true));
    yield put(setNearbyGroupsError(null));

    // Check if this is being called from RxDB listener (to avoid infinite loop)
    // If lastFetchParams already matches current request, skip pull and just read from RxDB
    const lastFetchParams = (yield select(
      (state: RootState) => state.groups.lastFetchParams
    )) as unknown as {
      latitude: number;
      longitude: number;
      radius: number;
    } | null;

    const isSameRequest =
      lastFetchParams &&
      lastFetchParams.latitude === action.payload.latitude &&
      lastFetchParams.longitude === action.payload.longitude &&
      lastFetchParams.radius === action.payload.radius;

    // Only pull if this is a new request (different params) or no previous params
    // This prevents infinite loop: listener -> fetchNearbyGroupsAction -> pullDocuments -> listener -> ...
    if (!isSameRequest) {
      // Set flag to prevent listener from triggering fetchNearbyGroupsAction during pull
      isPullingGroups = true;
      try {
        // First, ensure groups are pulled via replication (if not already done)
        // This ensures all data flows through RxDB, not direct API calls
        yield call(pullDocuments, ["groups"], undefined, {
          latitude: action.payload.latitude,
          longitude: action.payload.longitude,
          radius: action.payload.radius,
        });
      } finally {
        // Reset flag after pull completes (even if it fails)
        isPullingGroups = false;
      }
    } else {
      log.debug(
        "Skipping pullDocuments - same request params, reading from RxDB only"
      );
    }

    // Then read from RxDB (synced via replication)
    const response: NearbyGroupsResponse = yield call(
      discoverNearbyGroups,
      action.payload
    );

    yield put(setNearbyGroups(response.groups));
    // Store distances calculated locally from RxDB data
    yield put(setNearbyGroupsDistances(response.distances ?? []));
    yield put(setLastFetchParams(action.payload));
  } catch (error) {
    log.error("Failed to fetch nearby groups", error);
    yield put(
      setNearbyGroupsError(
        error instanceof Error ? error.message : "Failed to fetch nearby groups"
      )
    );
  } finally {
    yield put(setNearbyGroupsLoading(false));
  }
}

function* watchCreateGroup() {
  yield takeEvery(CREATE_GROUP, handleCreateGroup);
}

function* handleCreateGroup(action: {
  type: string;
  payload: {
    name: string;
    type: Group["type"];
    latitude: number;
    longitude: number;
    region_code?: string;
  };
}) {
  try {
    const group: Group = yield call(createGroupService, action.payload);
    yield put(setGroup(group));
    // Update device created group
    yield put(setDeviceCreatedGroup(group));

    // Pull groups replication after successful creation to refresh nearby groups list
    const deviceLocation = (yield select((state: RootState) =>
      selectDeviceLocation(state)
    )) as unknown as ReturnType<typeof selectDeviceLocation>;
    const radius = (yield select((state: RootState) =>
      selectSelectedRadius(state)
    )) as unknown as ReturnType<typeof selectSelectedRadius>;

    if (deviceLocation) {
      // Check if device is registered (has token) before pulling replication
      const token = getToken();
      if (token) {
        // Pull groups with location filter to include the newly created group
        yield call(pullDocuments, ["groups"], undefined, {
          latitude: deviceLocation.latitude,
          longitude: deviceLocation.longitude,
          radius,
        });
      } else {
        log.debug(
          "Skipping groups replication pull after create: Device not registered (no token)"
        );
      }
      log.debug("Pulled groups replication after creating group");

      // Small delay to ensure RxDB has been updated with the new group
      yield delay(100);

      // Trigger fetchNearbyGroupsAction to update nearbyGroups array in Redux
      // This ensures the newly created group appears in the list immediately
      // discoverNearbyGroups reads from RxDB, so the new group should be included
      yield put(
        fetchNearbyGroupsAction({
          latitude: deviceLocation.latitude,
          longitude: deviceLocation.longitude,
          radius,
        })
      );
      log.debug("Dispatched fetchNearbyGroupsAction after creating group", {
        groupId: group.id,
      });
    }
  } catch (error) {
    log.error("Failed to create group", error);
    // Error handling is done in the service layer
  }
}

function* watchFetchGroupDetails() {
  yield takeEvery(FETCH_GROUP_DETAILS, handleFetchGroupDetails);
}

function* handleFetchGroupDetails(action: { type: string; payload: string }) {
  const groupId = action.payload;
  try {
    yield put(setGroupLoading({ groupId, loading: true }));
    yield put(setGroupError({ groupId, error: null }));

    // Fetch group from service (reads from RxDB only)
    const group: Group | null = yield call(getGroup, groupId);

    if (group) {
      // Update Redux store with group
      // Note: Groups RxDB listener will also update Redux when RxDB changes,
      // but we update here immediately for faster UI response
      yield put(setGroup(group));
      log.debug("Group fetched and updated in Redux", { groupId });
    } else {
      // Group not in RxDB: trigger pull replication to fetch from server
      // This ensures all data flows through RxDB, not direct API calls
      log.debug("Group not in RxDB, triggering pull replication", { groupId });

      // Get device location for location-based pull
      const deviceLocation = (yield select((state: RootState) =>
        selectDeviceLocation(state)
      )) as unknown as ReturnType<typeof selectDeviceLocation>;
      const radius = (yield select((state: RootState) =>
        selectSelectedRadius(state)
      )) as unknown as ReturnType<typeof selectSelectedRadius>;

      // Check if device is registered (has token) before pulling replication
      const token = getToken();
      if (token) {
        // Pull groups replication (will update RxDB, which triggers listener to update Redux)
        yield call(
          pullDocuments,
          ["groups"],
          [groupId],
          deviceLocation
            ? {
                latitude: deviceLocation.latitude,
                longitude: deviceLocation.longitude,
                radius: radius || 5000,
              }
            : undefined
        );
      } else {
        log.debug(
          "Skipping groups replication pull for group details: Device not registered (no token)"
        );
      }

      // Check again after pull
      const groupAfterPull: Group | null = yield call(getGroup, groupId);
      if (groupAfterPull) {
        yield put(setGroup(groupAfterPull));
        log.debug("Group fetched after pull replication", { groupId });
      } else {
        log.warn("Group not found after pull replication", { groupId });
        yield put(
          setGroupError({
            groupId,
            error: "Group not found",
          })
        );
      }
    }

    yield put(setGroupLoading({ groupId, loading: false }));
  } catch (error) {
    log.error("Failed to fetch group details", error);
    yield put(
      setGroupError({
        groupId,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch group details",
      })
    );
    yield put(setGroupLoading({ groupId, loading: false }));
  }
}

// Track favorite toggle state to prevent duplicate calls
const togglingFavorites = new Set<string>();

/**
 * Watch for toggle favorite actions
 * Uses takeEvery with duplicate prevention to handle rapid clicks
 */
function* watchToggleFavorite() {
  yield takeEvery(TOGGLE_FAVORITE, handleToggleFavorite);
}

function* handleToggleFavorite(action: { type: string; payload: string }) {
  const groupId = action.payload;

  // Prevent duplicate toggles for the same group
  if (togglingFavorites.has(groupId)) {
    log.debug("Skipping duplicate favorite toggle", { groupId });
    return;
  }

  togglingFavorites.add(groupId);

  try {
    const currentlyFavorited: boolean = yield call(isFavorited, groupId);

    if (currentlyFavorited) {
      yield call(removeFavorite, groupId);
      yield put(removeFavoriteGroup(groupId));
    } else {
      yield call(addFavorite, groupId);
      yield put(addFavoriteGroup(groupId));
    }
  } catch (error) {
    log.error("Failed to toggle favorite", error);
  } finally {
    togglingFavorites.delete(groupId);
  }
}

/**
 * Check if device has created a group
 */
function* watchCheckDeviceCreatedGroup() {
  yield takeEvery(CHECK_DEVICE_CREATED_GROUP, handleCheckDeviceCreatedGroup);
}

function* handleCheckDeviceCreatedGroup() {
  try {
    const device = (yield select(selectDevice) as unknown) as ReturnType<
      typeof selectDevice
    >;

    if (!device?.id) {
      yield put(setDeviceCreatedGroup(null));
      return;
    }

    const group: Group | null = yield call(getDeviceCreatedGroup);
    yield put(setDeviceCreatedGroup(group));
  } catch (error) {
    log.error("Failed to check device created group", error);
    yield put(setDeviceCreatedGroup(null));
  }
}

/**
 * Monitor group status summary
 */
const activeStatusSummaryTasks = new Map<string, Task>();

function* watchStartGroupStatusSummary() {
  yield takeEvery(START_GROUP_STATUS_SUMMARY, handleStartGroupStatusSummary);
}

function* handleStartGroupStatusSummary(action: {
  type: string;
  payload: { groupId: string };
}) {
  const { groupId } = action.payload;

  // Cancel existing task if any
  const existingTask = activeStatusSummaryTasks.get(groupId);
  if (existingTask) {
    yield cancel(existingTask);
  }

  // Start new monitoring task
  const task: Task = yield fork(monitorGroupStatusSummary, groupId);
  activeStatusSummaryTasks.set(groupId, task);
}

function* watchStopGroupStatusSummary() {
  yield takeEvery(STOP_GROUP_STATUS_SUMMARY, handleStopGroupStatusSummary);
}

function* watchFetchGroupsDetails() {
  yield takeEvery(FETCH_GROUPS_DETAILS, handleFetchGroupsDetails);
}

/**
 * Watch for update group name actions
 * Uses takeLatest to cancel previous updates when new name is provided
 * Prevents duplicate API calls when user types rapidly
 */
function* watchUpdateGroupName() {
  yield takeLatest(UPDATE_GROUP_NAME, handleUpdateGroupName);
}

function* handleSuggestGroup(action: {
  type: string;
  payload: { latitude: number; longitude: number };
}): Generator<unknown, void, unknown> {
  try {
    yield put(setGroupSuggestionLoading(true));
    yield put(setGroupSuggestionError(null));

    const suggestion = (yield call(
      suggestGroupNameAndType,
      action.payload.latitude,
      action.payload.longitude
    )) as unknown as { suggested_name: string; suggested_type: Group["type"] };

    yield put(setGroupSuggestion(suggestion));
  } catch (error) {
    log.error("Failed to get group suggestion", error);
    yield put(
      setGroupSuggestionError(
        error instanceof Error ? error.message : "Failed to get suggestion"
      )
    );
    // Set default suggestion on error
    yield put(
      setGroupSuggestion({
        suggested_name: "",
        suggested_type: "village",
      })
    );
  } finally {
    yield put(setGroupSuggestionLoading(false));
  }
}

/**
 * Watch for suggest group actions
 * Uses takeLatest to cancel previous suggestions when location changes
 * Prevents duplicate API calls when user changes location rapidly
 */
function* watchSuggestGroup() {
  yield takeLatest(SUGGEST_GROUP, handleSuggestGroup);
}

function* handleUpdateGroupName(action: {
  type: string;
  payload: { groupId: string; name: string };
}): Generator<unknown, void, unknown> {
  const { groupId, name } = action.payload;

  try {
    yield put(setGroupLoading({ groupId, loading: true }));
    yield put(setGroupError({ groupId, error: null }));

    const updatedGroup = (yield call(
      updateGroupNameService,
      groupId,
      name
    )) as unknown as Group;

    // Update Redux state with new group data
    yield put(setGroup(updatedGroup));

    // Refetch group details to ensure all metadata is up to date
    yield put(fetchGroupDetailsAction(groupId));

    log.debug("Group name updated successfully", { groupId, newName: name });
  } catch (error) {
    log.error("Failed to update group name", error, { groupId, name });
    yield put(
      setGroupError({
        groupId,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update group name",
      })
    );
    throw error; // Re-throw so component can handle it
  } finally {
    yield put(setGroupLoading({ groupId, loading: false }));
  }
}

/**
 * Helper function to fetch details for a single group
 * This is called from saga using call()
 */
async function fetchGroupDetailsHelper(
  groupId: string,
  deviceId: string | null
) {
  try {
    const [latestMessage, unreadCount, statusSummary] = await Promise.all([
      getLatestMessage(groupId).catch(() => null),
      deviceId ? getUnreadCount(groupId).catch(() => 0) : Promise.resolve(0),
      getGroupStatusSummary(groupId).catch(() => ({ total_count: 0 })),
    ]);

    return {
      groupId,
      latestMessagePreview: latestMessage?.content
        ? latestMessage.content.substring(0, 50) +
          (latestMessage.content.length > 50 ? "..." : "")
        : null,
      unreadCount,
      activeMemberCount: statusSummary.total_count || 0,
    };
  } catch (error) {
    log.error("Failed to fetch group details", error, { groupId });
    return {
      groupId,
      latestMessagePreview: null,
      unreadCount: 0,
      activeMemberCount: 0,
    };
  }
}

// Track group details fetch state to prevent duplicate calls
const fetchingGroupsDetails = new Set<string>();
let lastFetchTime = 0;
const FETCH_DEBOUNCE_MS = 1000; // Minimum 1 second between fetches

/**
 * Handle fetching details for multiple groups
 * Collects latest message, unread count, favorite status, and status summary
 * and stores them in Redux store
 * Saga handles debouncing and duplicate prevention
 */
function* handleFetchGroupsDetails(action: {
  type: string;
  payload?: string[];
}): Generator<unknown, void, unknown> {
  const groupIds = action.payload ?? [];
  if (!Array.isArray(groupIds) || groupIds.length === 0) {
    return;
  }

  const now = Date.now();

  // Filter out groups that are already being fetched
  const groupsToFetch = groupIds.filter(
    (groupId) => !fetchingGroupsDetails.has(groupId)
  );

  // Debounce: Skip if fetch was called recently
  if (groupsToFetch.length === 0 || now - lastFetchTime < FETCH_DEBOUNCE_MS) {
    log.debug("Skipping duplicate group details fetch", {
      requested: groupIds.length,
      alreadyFetching: groupIds.length - groupsToFetch.length,
      timeSinceLastFetch: now - lastFetchTime,
    });
    return;
  }

  // Mark groups as being fetched
  groupsToFetch.forEach((groupId) => fetchingGroupsDetails.add(groupId));
  lastFetchTime = now;

  try {
    const device = (yield select(selectDevice)) as unknown as {
      id?: string;
    } | null;
    const deviceId = device?.id || null;

    // Collect details for all groups in parallel using redux-saga 'all'
    const details = (yield all(
      groupsToFetch.map((groupId: string) =>
        call(fetchGroupDetailsHelper, groupId, deviceId)
      )
    )) as Array<{
      groupId: string;
      latestMessagePreview: string | null;
      unreadCount: number;
      activeMemberCount: number;
    }>;

    // Update Redux store with collected details
    for (const detail of details) {
      yield put(
        setGroupDetails({
          groupId: detail.groupId,
          latestMessagePreview: detail.latestMessagePreview,
          unreadCount: detail.unreadCount,
          activeMemberCount: detail.activeMemberCount,
        })
      );
    }

    log.debug("Group details collected and stored in Redux", {
      count: details.length,
    });
  } catch (error) {
    log.error("Failed to fetch groups details", error, {
      groupIds: groupsToFetch,
    });
  } finally {
    // Remove groups from fetching set
    groupsToFetch.forEach((groupId) => fetchingGroupsDetails.delete(groupId));
  }
}

function* handleStopGroupStatusSummary(action: {
  type: string;
  payload: { groupId: string };
}) {
  const { groupId } = action.payload;
  const task = activeStatusSummaryTasks.get(groupId);
  if (task) {
    yield cancel(task);
    activeStatusSummaryTasks.delete(groupId);
  }
}

function* monitorGroupStatusSummary(groupId: string) {
  while (true) {
    try {
      const summary = (yield call(
        getGroupStatusSummary,
        groupId
      ) as unknown) as Awaited<ReturnType<typeof getGroupStatusSummary>>;
      yield put(setGroupStatusSummary({ groupId, summary }));
      yield delay(60000); // Poll every 60 seconds
    } catch (error) {
      log.error("Failed to monitor group status summary", error, { groupId });
      yield delay(60000);
    }
  }
}

// Root saga
/**
 * Watch RxDB groups collection for changes and sync to Redux
 * This listener ensures Redux store stays in sync with RxDB when replication updates data
 */
function* watchGroupsRxDBChanges() {
  try {
    const channel: EventChannel<Group[]> = yield call(createGroupsEventChannel);

    try {
      while (true) {
        const groups: Group[] = yield take(channel);
        // Update Redux store with all groups from RxDB
        // Groups are stored in byId structure for efficient lookup
        for (const group of groups) {
          yield put(setGroup(group));
        }
        log.debug("Groups RxDB listener: Updated Redux store", {
          count: groups.length,
        });

        // If we have last fetch params, automatically refresh nearbyGroups array
        // This ensures groups appear in the list immediately after replication
        // BUT: Only update nearbyGroups array directly (read from RxDB), do NOT trigger fetchNearbyGroupsAction
        // to avoid infinite loop: pullDocuments -> RxDB change -> listener -> fetchNearbyGroupsAction -> pullDocuments -> ...
        // Solution: Listener only updates nearbyGroups array by reading from RxDB (no pull)
        const lastFetchParams = (yield select(
          (state: RootState) => state.groups.lastFetchParams
        )) as unknown as {
          latitude: number;
          longitude: number;
          radius: number;
        } | null;

        if (lastFetchParams && !isPullingGroups) {
          // Small delay to ensure RxDB query gets the latest data
          yield delay(100);

          // Read from RxDB directly (no pull, no API call)
          // This updates nearbyGroups array without triggering another pull
          const response: NearbyGroupsResponse = yield call(
            discoverNearbyGroups,
            {
              latitude: lastFetchParams.latitude,
              longitude: lastFetchParams.longitude,
              radius: lastFetchParams.radius,
            }
          );

          yield put(setNearbyGroups(response.groups));
          yield put(setNearbyGroupsDistances(response.distances ?? []));
          log.debug(
            "Groups RxDB listener: Updated nearbyGroups array from RxDB",
            {
              groupsCount: groups.length,
              nearbyGroupsCount: response.groups.length,
              lastFetchParams,
            }
          );
        } else if (isPullingGroups) {
          log.debug(
            "Groups RxDB listener: Skipping nearbyGroups update (pull in progress)",
            {
              groupsCount: groups.length,
            }
          );
        }
      }
    } finally {
      const isCancelled: boolean = (yield cancelled()) as unknown as boolean;
      if (isCancelled) {
        channel.close();
        log.debug("Groups RxDB listener: Channel closed");
      }
    }
  } catch (error) {
    log.error("Failed to setup groups RxDB listener", error);
  }
}

/**
 * Create event channel for RxDB groups collection subscription
 */
function createGroupsEventChannel(): EventChannel<Group[]> {
  return eventChannel<Group[]>((emit) => {
    let unsubscribe: (() => void) | null = null;
    let isActive = true;

    // Setup RxDB subscription asynchronously
    getDatabase()
      .then((db) => {
        if (!isActive) return;

        // Subscribe to collection changes using collection.$ observable
        // This emits whenever ANY document in the collection changes (insert, update, delete)
        // changeEvent contains: { operation: 'INSERT' | 'UPDATE' | 'DELETE', documentData: {...} }
        const subscription = db.groups.$.subscribe(async (changeEvent: any) => {
          if (!isActive) return;

          try {
            // After any change, re-query all groups to get the latest state
            const allGroups = await db.groups.find().exec();
            const groups = allGroups.map((doc) => doc.toJSON() as Group);
            emit(groups);
            log.debug("Groups RxDB collection change detected", {
              changeType: changeEvent.operation,
              documentId: changeEvent.documentData?.id,
              groupsCount: groups.length,
            });
          } catch (err) {
            log.error("Failed to query groups after collection change", err);
          }
        });

        // Also emit initial state immediately
        db.groups
          .find()
          .exec()
          .then((docs) => {
            if (!isActive) return;
            const groups = docs.map((doc) => doc.toJSON() as Group);
            emit(groups);
            log.debug("Groups RxDB initial state emitted", {
              count: groups.length,
            });
          })
          .catch((err) => {
            log.error("Failed to get initial groups state", err);
            if (isActive) {
              emit([]); // Emit empty array on error
            }
          });

        unsubscribe = () => subscription.unsubscribe();
      })
      .catch((err) => {
        log.error("Failed to create groups RxDB subscription", err);
        if (isActive) {
          emit([]); // Emit empty array on error
        }
      });

    // Return cleanup function
    return () => {
      isActive = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  });
}

/**
 * Root group saga
 *
 * Debouncing/Throttling Patterns:
 * - takeLatest: Used for fetchNearbyGroups, suggestGroup, updateGroupName (cancels previous requests)
 * - takeEvery + duplicate prevention: Used for toggleFavorite, syncMessages (tracks in-progress requests)
 * - takeEvery + debouncing: Used for pullGroupsReplication, fetchGroupsDetails (time-based debouncing)
 */
export function* groupSaga() {
  yield fork(watchFetchNearbyGroups);
  yield fork(watchPullGroupsReplication);
  // Pull replication groups định kỳ mỗi 30s để đảm bảo dữ liệu group luôn mới
  yield fork(watchPeriodicGroupsReplication);
  yield fork(watchCreateGroup);
  yield fork(watchFetchGroupDetails);
  yield fork(watchToggleFavorite);
  yield fork(watchCheckDeviceCreatedGroup);
  yield fork(watchStartGroupStatusSummary);
  yield fork(watchStopGroupStatusSummary);
  yield fork(watchFetchGroupsDetails);
  yield fork(watchUpdateGroupName);
  yield fork(watchSuggestGroup);
  yield fork(watchGroupsRxDBChanges); // Start RxDB listener
}
