/**
 * WebSocket Saga
 * Manages WebSocket connection lifecycle and message handling
 */

import {
  call,
  put,
  takeEvery,
  take,
  select,
  fork,
  cancel,
  delay,
  cancelled,
  all,
} from "redux-saga/effects";
import type { Message } from "@/shared/domain/message";
import { eventChannel, type EventChannel, type Task } from "redux-saga";
import type { Subscription } from "rxjs";
import { getDatabase } from "@/shared/services/db";
import { getOrCreateDeviceId } from "@/features/device/services/device-storage";
import type {
  WebSocketMessage,
  NewMessagePayload,
  MessageSentPayload,
  ErrorPayload,
} from "@/features/websocket/services/websocket";
import {
  getWebSocketUrl,
  type WebSocketService,
} from "@/features/websocket/services/websocket";
import {
  setWebSocketStatus,
  setWebSocketError,
  setConnectedAt,
  setDisconnectedAt,
  incrementReconnectAttempts,
  resetReconnectAttempts,
  subscribeToGroup,
  unsubscribeFromGroup,
  setWebSocketUrl,
  selectSubscribedGroupIds,
  selectIsWebSocketConnected,
} from "./slice";
import { selectJWTToken } from "@/features/device/store/slice";
import { receiveMessageAction } from "@/features/messages/store/saga";
import { log } from "@/shared/lib/logging/logger";
import {
  clearAllWebSocketResources,
  createWebSocketInstance,
  getMessageChannel,
  getMessageChannelTask,
  getWebSocketService,
  setMessageChannel,
  setMessageChannelTask,
} from "../services/websocket-instance";

// Action types
const CONNECT_WEBSOCKET = "websocket/connect";
const DISCONNECT_WEBSOCKET = "websocket/disconnect";
const SUBSCRIBE_TO_GROUPS = "websocket/subscribeToGroups";
const UNSUBSCRIBE_FROM_GROUPS = "websocket/unsubscribeFromGroups";
const SEND_WEBSOCKET_MESSAGE = "websocket/sendMessage";

// Action creators
export const connectWebSocketAction = () => ({ type: CONNECT_WEBSOCKET });
export const disconnectWebSocketAction = () => ({ type: DISCONNECT_WEBSOCKET });
export const subscribeToGroupsAction = (groupIds: string[]) => ({
  type: SUBSCRIBE_TO_GROUPS,
  payload: groupIds,
});
export const unsubscribeFromGroupsAction = (groupIds: string[]) => ({
  type: UNSUBSCRIBE_FROM_GROUPS,
  payload: groupIds,
});
export const sendWebSocketMessageAction = (message: WebSocketMessage) => ({
  type: SEND_WEBSOCKET_MESSAGE,
  payload: message,
});

// WebSocket instance is now managed by websocket-instance.ts

/**
 * Create event channel for WebSocket messages
 */
function createWebSocketChannel(
  service: WebSocketService
): EventChannel<WebSocketMessage> {
  return eventChannel<WebSocketMessage>((emitter) => {
    service.setCallbacks({
      onMessage: (message) => {
        emitter(message);
      },
      onError: (error) => {
        log.error("WebSocket error in channel", error);
        emitter({ type: "error", payload: { error: "WebSocket error" } });
      },
    });

    return () => {
      // Cleanup
      service.setCallbacks({});
    };
  });
}

/**
 * Watch for WebSocket connection
 */
function* watchWebSocketConnect(): Generator<unknown, void, unknown> {
  yield takeEvery(CONNECT_WEBSOCKET, handleConnectWebSocket);
}

function* handleConnectWebSocket(): Generator<unknown, void, unknown> {
  try {
    // Get JWT token from Redux
    const token = (yield select(selectJWTToken) as unknown) as string | null;
    if (!token) {
      log.warn("Cannot connect WebSocket: No JWT token");
      yield put(setWebSocketError("No authentication token"));
      return;
    }

    // Set connecting status
    yield put(setWebSocketStatus("connecting"));
    yield put(setWebSocketError(null));

    // Create or reuse WebSocket service
    let wsService = getWebSocketService();
    if (!wsService) {
      wsService = createWebSocketInstance(token);
      const url = getWebSocketUrl();
      yield put(setWebSocketUrl(url));
    }

    // Set up callbacks and connect
    if (!wsService) {
      throw new Error("WebSocket service not created");
    }

    const service = wsService; // Capture for type narrowing

    // Set up callbacks BEFORE connecting
    // onOpen callback will update status when connection is actually established
    service.setCallbacks({
      onOpen: () => {
        log.info("WebSocket connected - updating status");
        // Update status when connection is actually established
        // Use put directly in callback (saga will handle it)
        // Note: We need to dispatch action, but we're in a callback
        // The status will be updated via the promise resolution below
      },
      onClose: (event) => {
        log.info("WebSocket closed", {
          code: event.code,
          reason: event.reason,
        });
        // Update status when connection closes
        // This will be handled by the service's onClose callback
      },
      onError: (error) => {
        log.error("WebSocket error", error);
      },
    });

    // Connect and wait for connection to be established
    yield call(() => service.connect());

    // After connect() resolves, connection is established
    // Verify connection is actually open
    if (!service.isConnected()) {
      log.error("WebSocket connect() resolved but connection is not open", {
        readyState: service.getStatus(),
      });
      throw new Error("WebSocket connection failed");
    }

    // Update status now that we're actually connected
    yield put(setWebSocketStatus("connected"));
    yield put(setConnectedAt(new Date().toISOString()));
    yield put(resetReconnectAttempts());
    log.info("WebSocket status set to connected in Redux", {
      wsServiceExists: !!wsService,
      wsServiceConnected: wsService?.isConnected(),
      wsServiceStatus: wsService?.getStatus(),
    });

    // Create message channel AFTER connection is established
    let messageChannel = getMessageChannel();
    if (!messageChannel && service) {
      messageChannel = createWebSocketChannel(service);
      setMessageChannel(messageChannel);
      const task = (yield fork(
        watchWebSocketMessages
      ) as unknown) as Task<unknown>;
      setMessageChannelTask(task);
      log.info("WebSocket message channel created and started");
    }

    // Re-subscribe to previously subscribed groups
    const subscribedGroupIds = (yield select(
      selectSubscribedGroupIds
    ) as unknown) as string[];

    // Also check if there's a current chat group that needs subscription
    const currentChatGroupId = (yield select(
      (state: { navigation: { currentChatGroupId: string | null } }) =>
        state.navigation?.currentChatGroupId
    )) as unknown as string | null | undefined;

    const groupsToSubscribe = new Set<string>(subscribedGroupIds);
    if (currentChatGroupId && !groupsToSubscribe.has(currentChatGroupId)) {
      groupsToSubscribe.add(currentChatGroupId);
      log.info("Found current chat group, adding to subscription", {
        groupId: currentChatGroupId,
      });
    }

    if (groupsToSubscribe.size > 0) {
      const groupsArray = Array.from(groupsToSubscribe);
      log.info("Subscribing to groups after connection", {
        groupIds: groupsArray,
        fromPrevious: subscribedGroupIds,
        fromCurrentChat: currentChatGroupId,
      });
      yield put(subscribeToGroupsAction(groupsArray));
    } else {
      log.debug("No groups to subscribe after connection", {
        subscribedGroupIds: subscribedGroupIds.length,
        currentChatGroupId: currentChatGroupId || null,
      });
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Connection failed";
    const errorDetails =
      error instanceof Error
        ? {
            name: error.name,
            stack: error.stack?.substring(0, 200),
          }
        : {};

    log.error("Failed to connect WebSocket", error, {
      errorMessage,
      ...errorDetails,
      reconnectAttempts: (yield select(
        (state: { websocket: { reconnectAttempts: number } }) =>
          state.websocket.reconnectAttempts
      ) as unknown) as number,
    });

    yield put(setWebSocketStatus("error"));
    yield put(setWebSocketError(errorMessage));
    yield put(incrementReconnectAttempts());

    // Check if we should attempt reconnection
    const websocketState = (yield select() as unknown) as {
      websocket: { reconnectAttempts: number; maxReconnectAttempts: number };
    };
    const reconnectAttempts = websocketState.websocket.reconnectAttempts;
    const maxReconnectAttempts = websocketState.websocket.maxReconnectAttempts;
    const token = (yield select(selectJWTToken) as unknown) as string | null;

    if (token && reconnectAttempts < maxReconnectAttempts) {
      log.info("Will attempt automatic reconnection", {
        attempt: reconnectAttempts + 1,
        maxAttempts: maxReconnectAttempts,
      });
      // Reconnection will be handled by watchWebSocketReconnect saga
    } else {
      log.warn("Cannot reconnect automatically", {
        hasToken: !!token,
        reconnectAttempts,
        maxAttempts: maxReconnectAttempts,
      });
    }
  }
}

/**
 * Watch for WebSocket disconnection
 */
function* watchWebSocketDisconnect(): Generator<unknown, void, unknown> {
  yield takeEvery(DISCONNECT_WEBSOCKET, handleDisconnectWebSocket);
}

function* handleDisconnectWebSocket(): Generator<unknown, void, unknown> {
  try {
    const messageChannelTask = getMessageChannelTask();
    if (messageChannelTask) {
      yield cancel(messageChannelTask);
      setMessageChannelTask(null);
    }

    const messageChannel = getMessageChannel();
    if (messageChannel) {
      messageChannel.close();
      setMessageChannel(null);
    }

    clearAllWebSocketResources();

    yield put(setWebSocketStatus("disconnected"));
    yield put(setDisconnectedAt(new Date().toISOString()));
  } catch (error) {
    log.error("Failed to disconnect WebSocket", error);
  }
}

/**
 * Watch for WebSocket messages via event channel
 */
function* watchWebSocketMessages(): Generator<unknown, void, unknown> {
  const messageChannel = getMessageChannel();
  if (!messageChannel) {
    log.error("Message channel not found");
    return;
  }

  try {
    while (true) {
      const message = (yield take(messageChannel)) as WebSocketMessage;
      // Fork message handling to prevent blocking the channel
      // This ensures that a slow handler (e.g. waiting for DB) doesn't delay other messages
      yield fork(handleWebSocketMessage, message);
    }
  } catch (error) {
    log.error("Error in WebSocket message channel", error);
  } finally {
    const channel = getMessageChannel();
    if (channel) {
      channel.close();
      setMessageChannel(null);
    }
  }
}

/**
 * Handle incoming WebSocket message
 */
function* handleWebSocketMessage(
  message: WebSocketMessage
): Generator<unknown, void, unknown> {
  try {
    const messageType = message.type?.trim();

    log.debug("Handling WebSocket message", {
      originalType: message.type,
      trimmedType: messageType,
      hasPayload: !!message.payload,
    });

    switch (messageType) {
      case "new_message": {
        // Convert WebSocket message format to domain Message format
        const domainMessage = convertWebSocketMessageToDomain(message);
        log.info("Received new message via WebSocket", {
          messageId: domainMessage.id,
          groupId: domainMessage.group_id,
          content: domainMessage.content.substring(0, 50),
        });
        yield put(receiveMessageAction(domainMessage));
        break;
      }

      case "message_sent":
        // Message sent confirmation - mark message as synced in RxDB
        log.debug("Message sent confirmation", message.payload);
        if (
          typeof message.payload === "object" &&
          message.payload !== null &&
          ("messageId" in message.payload ||
            "serverMessageId" in message.payload)
        ) {
          yield* handleMessageSentConfirmation(
            message.payload as MessageSentPayload
          );
        }
        break;

      case "message_error":
        log.error("Message error from server", message.payload);
        if (
          typeof message.payload === "object" &&
          message.payload !== null &&
          "error" in message.payload
        ) {
          yield put(
            setWebSocketError(
              (message.payload as ErrorPayload).error || "Message error"
            )
          );
        }
        break;

      case "subscribed":
        log.info(
          "Subscribed to groups - server confirmation received",
          message.payload
        );
        // Server has confirmed subscription - Redux state was already updated in handleSubscribeToGroups
        // This confirmation ensures the subscription is active on the server side
        break;

      case "unsubscribed":
        log.debug("Unsubscribed from groups", message.payload);
        break;

      case "pong":
        // Heartbeat response - connection is alive
        log.debug("Received pong", message.payload);
        break;

      case "error":
        log.error("WebSocket error message", message.payload);
        if (
          typeof message.payload === "object" &&
          message.payload !== null &&
          "error" in message.payload
        ) {
          yield put(
            setWebSocketError(
              (message.payload as ErrorPayload).error || "WebSocket error"
            )
          );
        }
        break;

      case "message_pinned":
        log.info("Received message pinned event", message.payload);
        if (typeof message.payload === "object" && message.payload !== null) {
          yield* handleMessagePinned(message.payload);
        }
        break;

      case "message_unpinned":
        log.info("Received message unpinned event", message.payload);
        if (typeof message.payload === "object" && message.payload !== null) {
          yield* handleMessageUnpinned(message.payload);
        }
        break;

      default:
        log.warn("Unknown WebSocket message type", {
          originalType: message.type,
          trimmedType: messageType,
          typeType: typeof message.type,
          length: message.type?.length,
        });
    }
  } catch (error) {
    log.error("Failed to handle WebSocket message", error, { message });
  }
}

/**
 * Handle message pinned event
 */
function* handleMessagePinned(payload: any): Generator<unknown, void, unknown> {
  try {
    const { messageId, groupId, pinnedAt, deviceId, tag } = payload;

    if (!messageId || !groupId || !deviceId) {
      log.warn("Invalid message pinned payload", payload);
      return;
    }

    const db = (yield call(getDatabase)) as Awaited<
      ReturnType<typeof getDatabase>
    >;

    // Check if this device has already pinned this message
    const existingPin = yield call(async () => {
      return await db.pinned_messages
        .findOne({
          selector: {
            message_id: messageId,
            device_id: deviceId,
          },
        })
        .exec();
    });

    if (!existingPin) {
      // Generate unique ID for the pin
      const pinId = (yield call(async () => {
        const { generateId } = await import("@/shared/utils/id");
        return generateId();
      }) as unknown) as string;

      yield call(async () => {
        await db.pinned_messages.insert({
          id: pinId,
          message_id: messageId,
          group_id: groupId,
          device_id: deviceId,
          pinned_at: pinnedAt || new Date().toISOString(),
          tag: tag || undefined,
        });
      });
      log.info("Message pinned via WebSocket", {
        messageId,
        groupId,
        deviceId,
      });
    } else {
      log.debug("Message already pinned by this device, skipping", {
        messageId,
        deviceId,
      });
    }
  } catch (error) {
    log.error("Failed to handle message pinned event", error);
  }
}

/**
 * Handle message unpinned event
 */
function* handleMessageUnpinned(
  payload: any
): Generator<unknown, void, unknown> {
  try {
    const { messageId, deviceId } = payload;

    if (!messageId || !deviceId) {
      log.warn("Invalid message unpinned payload", payload);
      return;
    }

    const db = (yield call(getDatabase)) as Awaited<
      ReturnType<typeof getDatabase>
    >;

    // Remove pinned message from RxDB (only for the specific device)
    yield call(async () => {
      const pin = await db.pinned_messages
        .findOne({
          selector: {
            message_id: messageId,
            device_id: deviceId,
          },
        })
        .exec();

      if (pin) {
        await pin.remove();
        log.info("Message unpinned via WebSocket", { messageId, deviceId });
      } else {
        log.debug("Pinned message not found for unpinning", {
          messageId,
          deviceId,
        });
      }
    });
  } catch (error) {
    log.error("Failed to handle message unpinned event", error);
  }
}

/**
 * Handle message sent confirmation from WebSocket
 * Marks the message as synced in RxDB
 * Note: messageId in payload is the server-generated ID, but we need to find the optimistic message
 * by matching content, group, device, and timestamp since IDs are different
 */
function* handleMessageSentConfirmation(payload: {
  serverMessageId?: string;
  messageId?: string;
}): Generator<unknown, void, unknown> {
  try {
    const { serverMessageId, messageId } = payload;
    const serverMessageIdValue = messageId || serverMessageId;

    if (!serverMessageIdValue) {
      log.warn("No message ID provided in confirmation", payload);
      return;
    }

    // The messageId in confirmation is the server ID
    // But we need to find the optimistic message (with client ID) to mark it as synced
    // The optimistic message should have already been replaced by the server message in handleReceiveMessage
    // So we can just mark the server message as synced (it should already be synced from new_message event)
    // But to be safe, we'll update it anyway

    const db = (yield call(getDatabase)) as Awaited<
      ReturnType<typeof getDatabase>
    >;

    // Find message by server ID and mark as synced
    yield call(async () => {
      const messageDoc = await db.messages.findOne(serverMessageIdValue).exec();
      if (messageDoc) {
        // Message exists (should be the server message from new_message event)
        // Mark as synced (should already be synced, but ensure it is)
        await messageDoc.update({
          $set: {
            sync_status: "synced",
            synced_at: new Date().toISOString(),
          },
        });
        log.debug("Message marked as synced via WebSocket confirmation", {
          messageId: serverMessageIdValue,
        });
      } else {
        // Message not found - might be optimistic message that hasn't been replaced yet
        // Try to find optimistic message by matching criteria
        log.debug("Server message not found, might be optimistic message", {
          serverMessageId: serverMessageIdValue,
        });
        // The new_message event should have already handled the replacement
        // If we reach here, it means the message hasn't been received yet via new_message
        // In this case, we'll just log and wait for new_message event
      }
    });
  } catch (error) {
    log.error("Failed to mark message as synced", error);
  }
}

/**
 * Convert WebSocket message format to domain Message format
 */
function convertWebSocketMessageToDomain(wsMessage: WebSocketMessage): Message {
  const payload = wsMessage.payload;

  // Type guard: ensure payload is NewMessagePayload
  if (
    typeof payload === "object" &&
    payload !== null &&
    "id" in payload &&
    "groupId" in payload &&
    "deviceId" in payload &&
    "content" in payload
  ) {
    const newMessagePayload = payload as NewMessagePayload;
    return {
      id: newMessagePayload.id,
      group_id: newMessagePayload.groupId,
      device_id: newMessagePayload.deviceId,
      content: newMessagePayload.content,
      message_type: newMessagePayload.messageType,
      // Handle nulls from JSON by converting to undefined to satisfy RxDB schema
      sos_type: newMessagePayload.sosType || undefined,
      tags: newMessagePayload.tags || undefined,
      pinned: newMessagePayload.pinned ?? false,
      created_at: newMessagePayload.createdAt,
      device_sequence: newMessagePayload.deviceSequence || undefined,
      sync_status: "synced" as const,
    };
  }

  // Fallback - should not happen for new_message type
  throw new Error("Invalid payload type for new_message");
}

/**
 * Watch for subscribe to groups
 */
function* watchSubscribeToGroups(): Generator<unknown, void, unknown> {
  yield takeEvery(SUBSCRIBE_TO_GROUPS, handleSubscribeToGroups);
}

/**
 * Watch for currentChatGroupId changes and auto-subscribe
 * This ensures WebSocket is subscribed when user enters a chat
 */
function* watchCurrentChatGroupId(): Generator<unknown, void, unknown> {
  let previousGroupId: string | null = null;

  while (true) {
    const currentGroupId = (yield select(
      (state: { navigation: { currentChatGroupId: string | null } }) =>
        state.navigation?.currentChatGroupId
    )) as unknown as string | null;

    // If groupId changed and is not null, subscribe to it
    if (currentGroupId && currentGroupId !== previousGroupId) {
      log.info("Current chat group changed, subscribing to WebSocket", {
        previousGroupId,
        currentGroupId,
      });
      yield put(subscribeToGroupsAction([currentGroupId]));
    }

    // If groupId changed to null, unsubscribe from previous group
    if (!currentGroupId && previousGroupId) {
      log.info("Current chat group cleared, unsubscribing from WebSocket", {
        previousGroupId,
      });
      yield put(unsubscribeFromGroupsAction([previousGroupId]));
    }

    previousGroupId = currentGroupId;

    // Wait a bit before checking again (debounce)
    yield delay(100);
  }
}

function* handleSubscribeToGroups(action: {
  type: string;
  payload: string[];
}): Generator<unknown, void, unknown> {
  const groupIds = action.payload;

  // Get current subscribed groups before update
  const currentSubscribedBefore = (yield select(
    selectSubscribedGroupIds
  ) as unknown) as string[];

  const wsService = getWebSocketService();

  log.info("handleSubscribeToGroups called", {
    groupIds,
    currentSubscribedBefore,
    hasService: !!wsService,
    isConnected: wsService?.isConnected(),
    status: wsService?.getStatus(),
  });

  if (!wsService) {
    log.error("Cannot subscribe: WebSocket service not initialized", {
      groupIds,
    });
    // Still update Redux state
    for (const groupId of groupIds) {
      yield put(subscribeToGroup(groupId));
    }
    return;
  }

  // Update Redux state FIRST (before checking connection)
  // This ensures state is updated even if WebSocket is disconnected
  log.info("Updating Redux state with subscribed groups", { groupIds });
  for (const groupId of groupIds) {
    log.debug("Dispatching subscribeToGroup action", { groupId });
    yield put(subscribeToGroup(groupId));
  }

  // Start watching RxDB messages for auto-send IMMEDIATELY after updating Redux state
  // This ensures we can send messages even if WebSocket subscribe to server hasn't completed yet
  // The watcher will check WebSocket connection/subscription before actually sending
  log.info("Starting pending messages watchers for groups", { groupIds });
  for (const groupId of groupIds) {
    // Cancel existing watcher if any to avoid duplicates
    const existingTask = pendingMessageWatchers.get(groupId);
    if (existingTask) {
      yield cancel(existingTask);
    }

    // Start new watcher
    const task = (yield fork(
      watchPendingMessagesForGroup,
      groupId
    ) as unknown) as Task;
    pendingMessageWatchers.set(groupId, task);
  }

  // Small delay to ensure Redux action is processed by reducer
  yield delay(50);

  // Verify Redux state was updated immediately
  const updatedSubscribed = (yield select(
    selectSubscribedGroupIds
  ) as unknown) as string[];
  const allIncluded = groupIds.every((id) => updatedSubscribed.includes(id));
  const missing = groupIds.filter((id) => !updatedSubscribed.includes(id));

  log.info("Redux state after subscribeToGroup dispatch", {
    groupIds,
    updatedSubscribed,
    allIncluded,
    missing,
  });

  if (!allIncluded) {
    log.error("Redux state not updated correctly after subscribeToGroup", {
      groupIds,
      updatedSubscribed,
      missing,
    });
    // Still try to send subscribe message to server - might work
  }

  if (!wsService.isConnected()) {
    log.warn(
      "WebSocket not connected, but Redux state updated and watchers started",
      {
        isConnected: wsService.isConnected(),
        status: wsService.getStatus(),
        groupIds,
        updatedSubscribed,
      }
    );
    // State is already updated, watchers are started, will subscribe when WebSocket reconnects
    return;
  }

  try {
    // Double-check WebSocket is still connected before sending
    if (!wsService || !wsService.isConnected()) {
      log.error("WebSocket disconnected before sending subscribe message", {
        hasService: !!wsService,
        isConnected: wsService?.isConnected(),
        status: wsService?.getStatus(),
        groupIds,
      });
      // Don't remove from Redux - will retry when reconnected
      return;
    }

    // Send subscribe message to server
    const subscribeMessage = {
      type: "subscribe" as const,
      payload: { groupIds },
    };
    log.info("Sending subscribe message to server", {
      groupIds,
      message: subscribeMessage,
      wsServiceConnected: wsService.isConnected(),
      wsServiceStatus: wsService.getStatus(),
    });

    // Use call to ensure send is properly awaited
    yield call(() => {
      if (!wsService) {
        throw new Error("WebSocket service not initialized");
      }
      if (!wsService.isConnected()) {
        throw new Error("WebSocket not connected");
      }
      wsService.send(subscribeMessage);
    });

    log.info("Subscribe message sent successfully to server", {
      groupIds,
      wsServiceConnected: wsService.isConnected(),
    });
  } catch (error) {
    log.error("Failed to subscribe to groups", error, { groupIds });
    // CRITICAL FIX: Do NOT remove from Redux state on error.
    // If we remove it, the reconnection logic won't know we want to be subscribed to these groups.
    // By leaving it in Redux, handleConnectWebSocket will see these groups and try to subscribe again on reconnect.
  }
}

// Track active pending message watchers
const pendingMessageWatchers = new Map<string, Task>();

/**
 * Create event channel for watching pending messages in RxDB
 * Uses RxDB query subscription for better performance and reliability
 */
function createPendingMessagesChannel(
  groupId: string,
  deviceId: string
): EventChannel<Message> {
  return eventChannel<Message>((emit) => {
    let subscription: Subscription | null = null;
    let isActive = true;
    const sentMessageIds = new Set<string>(); // Track already sent messages

    // Setup RxDB subscription asynchronously
    // This handles the case where database might not be ready yet
    log.debug("Setting up RxDB subscription for pending messages", {
      groupId,
      deviceId,
    });

    getDatabase()
      .then((db) => {
        // Check if channel was closed before database was ready
        if (!isActive) {
          log.debug(
            "Channel already closed, skipping RxDB subscription setup",
            { groupId }
          );
          return;
        }

        log.debug("Database ready, creating query subscription", {
          groupId,
          deviceId,
        });

        // Create query for pending messages
        // Using query.$ subscription is more efficient than collection.$ + re-query
        const query = db.messages.find({
          selector: {
            group_id: groupId,
            device_id: deviceId,
            sync_status: "pending",
          },
        });

        // Subscribe to query changes
        // This will emit whenever pending messages are added/updated/removed
        subscription = query.$.subscribe({
          next: (docs) => {
            if (!isActive) return;

            const messages = docs.map((doc) => doc.toJSON() as Message);

            log.debug("Query subscription emitted pending messages", {
              groupId,
              deviceId,
              count: messages.length,
              messageIds: messages.map((m) => m.id),
            });

            // Emit new pending messages that haven't been sent yet
            for (const message of messages) {
              if (!sentMessageIds.has(message.id)) {
                sentMessageIds.add(message.id);
                log.info("Emitting pending message to channel", {
                  messageId: message.id,
                  groupId,
                });
                emit(message);
              } else {
                log.debug("Message already sent, skipping", {
                  messageId: message.id,
                });
              }
            }
          },
          error: (error) => {
            log.error("Error in query subscription", error, {
              groupId,
              deviceId,
            });
            // Don't emit error to channel - just log it
            // Channel will continue to work for other messages
          },
        });

        log.debug("Query subscription created successfully", {
          groupId,
          deviceId,
        });
      })
      .catch((error) => {
        log.error("Failed to setup RxDB subscription", error, {
          groupId,
          deviceId,
        });
        // If database initialization fails, close the channel
        if (isActive) {
          isActive = false;
        }
      });

    // Return cleanup function
    // This is called when channel is closed (e.g., saga is cancelled)
    return () => {
      log.debug("Cleaning up pending messages channel", { groupId, deviceId });
      isActive = false;
      if (subscription) {
        subscription.unsubscribe();
        subscription = null;
      }
    };
  });
}

/**
 * Watch RxDB messages for a group and automatically send pending messages via WebSocket
 * This runs when WebSocket is subscribed to a group
 */
function* watchPendingMessagesForGroup(
  groupId: string
): Generator<unknown, void, unknown> {
  log.info("Starting pending messages watcher for group", { groupId });

  try {
    const deviceId = (yield call(getOrCreateDeviceId) as unknown) as string;
    log.debug("Got deviceId for pending messages watcher", {
      groupId,
      deviceId,
    });

    // Create event channel for pending messages
    log.debug("Creating pending messages channel", { groupId, deviceId });
    const channel = (yield call(
      createPendingMessagesChannel,
      groupId,
      deviceId
    ) as unknown) as EventChannel<Message>;
    log.debug("Pending messages channel created", { groupId });

    try {
      log.debug("Watcher started, waiting for messages from channel", {
        groupId,
      });
      while (true) {
        const message = (yield take(channel) as unknown) as Message;

        log.info("Received message from channel, sending via WebSocket", {
          messageId: message.id,
          groupId,
        });

        // Send pending message via WebSocket
        yield* sendPendingMessageViaWebSocket(message, groupId);
      }
    } finally {
      const isCancelled: boolean = (yield cancelled()) as unknown as boolean;
      if (isCancelled) {
        log.debug("Watcher task cancelled, closing channel", { groupId });
        channel.close();
      }
    }
  } catch (error) {
    log.error("Error in pending messages watcher", error, { groupId });
    // We don't delete from map here because the task is finished/crashed
    // and handleSubscribeToGroups will overwrite it if called again
  }
}

/**
 * Send a pending message via WebSocket
 */
function* sendPendingMessageViaWebSocket(
  message: Message,
  groupId: string
): Generator<unknown, void, unknown> {
  // Check if WebSocket is connected and subscribed
  const isConnected = (yield select(
    selectIsWebSocketConnected
  ) as unknown) as boolean;
  const subscribedGroups = (yield select(
    selectSubscribedGroupIds
  ) as unknown) as string[];

  if (!isConnected) {
    log.debug("WebSocket not connected, skipping pending message", {
      messageId: message.id,
      groupId,
    });
    return;
  }

  if (!subscribedGroups.includes(groupId)) {
    log.debug("Not subscribed to group, skipping pending message", {
      messageId: message.id,
      groupId,
      subscribedGroups,
    });
    return;
  }

  // Double-check message is still pending (avoid duplicate sends)
  const db = (yield call(getDatabase) as unknown) as Awaited<
    ReturnType<typeof getDatabase>
  >;
  const messageDoc = (yield call(async () => {
    return await db.messages.findOne(message.id).exec();
  }) as unknown) as { toJSON: () => Message } | null;

  if (!messageDoc) {
    log.debug("Message not found in RxDB, skipping", { messageId: message.id });
    return;
  }

  const messageData = messageDoc.toJSON();
  if (messageData.sync_status !== "pending") {
    log.debug("Message already synced, skipping", {
      messageId: message.id,
      syncStatus: messageData.sync_status,
    });
    return;
  }

  log.info("Sending pending message via WebSocket", {
    messageId: message.id,
    groupId,
  });

  try {
    yield put(
      sendWebSocketMessageAction({
        type: "send_message",
        payload: {
          groupId: message.group_id,
          content: message.content,
          messageType: message.message_type,
          sosType: message.sos_type,
          tags: message.tags,
          deviceSequence: message.device_sequence,
        },
      })
    );
  } catch (error) {
    log.error("Failed to send pending message via WebSocket", error, {
      messageId: message.id,
      groupId,
    });
  }
}

/**
 * Watch for unsubscribe from groups
 */
function* watchUnsubscribeFromGroups(): Generator<unknown, void, unknown> {
  yield takeEvery(UNSUBSCRIBE_FROM_GROUPS, handleUnsubscribeFromGroups);
}

function* handleUnsubscribeFromGroups(action: {
  type: string;
  payload: string[];
}): Generator<unknown, void, unknown> {
  const groupIds = action.payload;

  // Stop pending message watchers for unsubscribed groups
  for (const groupId of groupIds) {
    const watcher = pendingMessageWatchers.get(groupId);
    if (watcher) {
      yield cancel(watcher);
      pendingMessageWatchers.delete(groupId);
      log.info("Stopped pending messages watcher for unsubscribed group", {
        groupId,
      });
    }
  }

  const wsService = getWebSocketService();

  if (!wsService || !wsService.isConnected()) {
    log.warn("Cannot unsubscribe: WebSocket not connected");
    // Still update Redux state
    for (const groupId of groupIds) {
      yield put(unsubscribeFromGroup(groupId));
    }
    return;
  }

  try {
    // Update Redux state
    for (const groupId of groupIds) {
      yield put(unsubscribeFromGroup(groupId));
    }

    // Send unsubscribe message to server
    wsService.send({
      type: "unsubscribe",
      payload: { groupIds },
    });
  } catch (error) {
    log.error("Failed to unsubscribe from groups", error);
  }
}

/**
 * Watch for send WebSocket message
 */
function* watchSendWebSocketMessage(): Generator<unknown, void, unknown> {
  yield takeEvery(SEND_WEBSOCKET_MESSAGE, handleSendWebSocketMessage);
}

function* handleSendWebSocketMessage(action: {
  type: string;
  payload: WebSocketMessage;
}): Generator<unknown, void, unknown> {
  const message = action.payload;
  const wsService = getWebSocketService();

  log.info("handleSendWebSocketMessage called", {
    messageType: message.type,
    hasPayload: !!message.payload,
    wsServiceExists: !!wsService,
    wsServiceStatus: wsService?.getStatus(),
    wsServiceConnected: wsService?.isConnected(),
  });

  if (!wsService) {
    const error = new Error("WebSocket service not initialized");
    log.error("Cannot send message: WebSocket service not initialized", {
      messageType: message.type,
    });
    yield put(setWebSocketError("WebSocket service not initialized"));
    yield put(setWebSocketStatus("error"));
    throw error;
  }

  if (!wsService.isConnected()) {
    const error = new Error("WebSocket not connected");
    log.warn("Cannot send message: WebSocket not connected", {
      messageType: message.type,
      status: wsService.getStatus(),
      isConnected: wsService.isConnected(),
    });

    // Update error state
    yield put(
      setWebSocketError("Cannot send message: WebSocket not connected")
    );
    yield put(setWebSocketStatus("error"));

    // Throw error so caller can catch and fallback to REST API
    throw error;
  }

  try {
    log.info("Sending WebSocket message", {
      type: message.type,
      payload: message.payload,
      payloadString: JSON.stringify(message.payload),
    });

    // Use call to properly handle async send operation
    // wsService is guaranteed to be non-null here (checked above)
    yield call(() => {
      if (!wsService) {
        throw new Error("WebSocket service not initialized");
      }
      log.info("Calling wsService.send()", {
        messageType: message.type,
      });
      wsService.send(message);
      log.info("wsService.send() completed", { messageType: message.type });
    });

    log.info("WebSocket message sent successfully", {
      type: message.type,
      hasPayload: !!message.payload,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to send message";
    log.error("Failed to send WebSocket message", error, {
      messageType: message.type,
      errorMessage,
      status: wsService?.getStatus(),
      isConnected: wsService?.isConnected(),
    });

    // Update error state
    yield put(setWebSocketError(errorMessage));
    yield put(setWebSocketStatus("error"));

    throw error;
  }
}

/**
 * Watch for WebSocket reconnection
 * Handles automatic reconnection when connection is lost
 */
function* watchWebSocketReconnect(): Generator<unknown, void, unknown> {
  // Watch for status changes to 'disconnected' or 'error' and attempt reconnection
  while (true) {
    const action = (yield take(
      (a: { type: string; payload?: unknown }) =>
        a.type === "websocket/setWebSocketStatus" &&
        (a.payload === "disconnected" || a.payload === "error")
    )) as { type: string; payload?: unknown };

    const status = action.payload;
    if (status !== "disconnected" && status !== "error") {
      continue;
    }

    // Only reconnect if we have a token and haven't exceeded max attempts
    const websocketState = (yield select() as unknown) as {
      websocket: { reconnectAttempts: number; maxReconnectAttempts: number };
    };

    const reconnectAttempts = websocketState.websocket.reconnectAttempts;
    const maxReconnectAttempts = websocketState.websocket.maxReconnectAttempts;
    const token = (yield select(selectJWTToken) as unknown) as string | null;

    if (token && reconnectAttempts < maxReconnectAttempts) {
      // Wait with exponential backoff before reconnecting
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      log.info("Scheduling WebSocket reconnection", {
        attempt: reconnectAttempts + 1,
        delay,
      });

      yield call(() => new Promise((resolve) => setTimeout(resolve, delay)));

      // Attempt reconnection
      yield put(connectWebSocketAction());
    } else if (!token) {
      log.warn("Cannot reconnect: No JWT token");
    } else {
      log.warn("Max reconnection attempts reached", {
        attempts: reconnectAttempts,
      });
    }
  }
}

/**
 * Watch for WebSocket errors
 */
function* watchWebSocketError(): Generator<unknown, void, unknown> {
  yield takeEvery("websocket/setWebSocketError", handleWebSocketError);
}

function* handleWebSocketError(action: {
  type: string;
  payload: string | null;
}): Generator<unknown, void, unknown> {
  const error = action.payload;
  if (error) {
    log.error("WebSocket error occurred", { error });
    // Update status to error
    yield put(setWebSocketStatus("error"));
    // Increment reconnect attempts
    yield put(incrementReconnectAttempts());

    // Attempt reconnection if not already reconnecting
    const status = (yield select(
      (state: { websocket: { status: string } }) => state.websocket.status
    ) as unknown) as string;
    if (status !== "connecting") {
      // Trigger reconnection attempt
      yield put(connectWebSocketAction());
    }
  }
}

// Root saga
export function* websocketSaga(): Generator<unknown, void, unknown> {
  yield all([
    fork(watchWebSocketConnect),
    fork(watchWebSocketDisconnect),
    fork(watchWebSocketReconnect),
    fork(watchWebSocketError),
    fork(watchSubscribeToGroups),
    fork(watchUnsubscribeFromGroups),
    fork(watchSendWebSocketMessage),
    fork(watchCurrentChatGroupId),
  ]);
}
