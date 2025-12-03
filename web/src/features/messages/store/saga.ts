import { call, put, takeEvery, take, fork, cancel, cancelled, delay, select } from 'redux-saga/effects';
import { eventChannel, type EventChannel, type Task } from 'redux-saga';
import type { Message, MessageCreateRequest } from "@/shared/domain/message";
import type { PinnedMessage } from "@/shared/domain/pinned_message";
import { createMessage } from "@/features/messages/services/message-service";
import { getPinnedMessages } from "@/features/messages/services/pin-service";
import { getDatabase, watchGroupMessages, watchPinnedMessages } from "@/shared/services/db";
import { pullDocuments } from "@/features/replication/services/replication-sync";
import { getOrCreateDeviceId } from "@/features/device/services/device-storage";
import {
  setMessages,
  setPinnedMessages,
  setPinnedMessagesLoading,
  setPinnedMessagesError,
  setMessagesError,
  markMessageReceived,
  removePendingMessage
} from './slice';
import { sendWebSocketMessageAction } from '@/features/websocket/store/saga';
import { log } from "@/shared/lib/logging/logger";

// Action types
const SEND_MESSAGE = 'messages/sendMessage';
const RECEIVE_MESSAGE = 'messages/receiveMessage';
const SYNC_MESSAGES = 'messages/syncMessages';
const START_MESSAGE_SUBSCRIPTION = 'messages/startSubscription';
const STOP_MESSAGE_SUBSCRIPTION = 'messages/stopSubscription';
const FETCH_PINNED_MESSAGES = 'messages/fetchPinnedMessages';

// Action creators
export const sendMessageAction = (request: MessageCreateRequest) => ({
  type: SEND_MESSAGE,
  payload: request,
});
export const receiveMessageAction = (message: Message) => ({
  type: RECEIVE_MESSAGE,
  payload: message,
});
export const syncMessagesAction = (groupId: string) => ({
  type: SYNC_MESSAGES,
  payload: groupId,
});
export const startMessageSubscriptionAction = (groupId: string, limit?: number) => ({
  type: START_MESSAGE_SUBSCRIPTION,
  payload: { groupId, limit },
});
export const stopMessageSubscriptionAction = (groupId: string) => ({
  type: STOP_MESSAGE_SUBSCRIPTION,
  payload: { groupId },
});
export const fetchPinnedMessagesAction = (groupId: string) => ({
  type: FETCH_PINNED_MESSAGES,
  payload: { groupId },
});

// Sagas
function* watchSendMessage() {
  yield takeEvery(SEND_MESSAGE, handleSendMessage);
}

function* handleSendMessage(action: { type: string; payload: MessageCreateRequest }) {
  try {
    const { group_id } = action.payload;
    yield put(setMessagesError({ groupId: group_id, error: null }));
    
    // Create message and insert into RxDB
    // Flow: insert RxDB → watchPendingMessagesForGroup detects → automatically sends via WebSocket
    const message: Message = yield call(createMessage, action.payload);
    
    log.info('Message inserted into RxDB', {
      messageId: message.id,
      groupId: group_id,
      syncStatus: message.sync_status,
    });
    
    // Message is now in RxDB with sync_status='pending'
    // watchPendingMessagesForGroup (started when WebSocket subscribes to group) will detect it
    // and automatically send via WebSocket when WebSocket is connected and subscribed
    // If WebSocket is not connected/subscribed, message will be synced via REST API replication
    
    // Message is stored in RxDB with sync_status='pending'
    // - If WebSocket succeeds: message_sent event will mark it as synced
    // - If WebSocket fails: replication sync will push it via REST API
  } catch (error) {
    log.error('Failed to send message', error);
    yield put(
      setMessagesError({
        groupId: action.payload.group_id,
        error: error instanceof Error ? error.message : 'Failed to send message',
      })
    );
  }
}

function* watchReceiveMessage() {
  yield takeEvery(RECEIVE_MESSAGE, handleReceiveMessage);
}

function* handleReceiveMessage(action: { type: string; payload: Message }): Generator<unknown, void, unknown> {
  try {
    const message = action.payload;
    
    // Check for duplicates by message ID
    const state = (yield select() as unknown) as { messages: { receivedMessageIds: string[] } };
    const alreadyReceived = state.messages.receivedMessageIds.includes(message.id);
    if (alreadyReceived) {
      log.debug('Duplicate message received, skipping', { messageId: message.id });
      return;
    }
    
    // Mark as received
    yield put(markMessageReceived({ messageId: message.id }));
    
    const db = (yield call(getDatabase) as unknown) as Awaited<ReturnType<typeof getDatabase>>;
    const deviceId = (yield call(getOrCreateDeviceId) as unknown) as string;
    
    log.debug('Processing received message', {
      messageId: message.id,
      messageDeviceId: message.device_id,
      localDeviceId: deviceId,
      isMatch: message.device_id === deviceId,
      content: message.content
    });

    // Check if this is our own message (optimistic update scenario)
    // If we sent a message with client ID, server creates new message with server ID
    // We need to match and update the optimistic message
    if (message.device_id === deviceId) {
      // This might be our own message from server
      // Try to find optimistic message with same content, group, and similar timestamp
      const optimisticMessage = (yield call(async () => {
        // Fetch all pending messages for this group/device in the time window
        // We don't filter by content in the query to handle potential server-side trimming/modification
        const messages = await db.messages
          .find({
            selector: {
              group_id: message.group_id,
              device_id: deviceId,
              sync_status: 'pending',
              // Created within last 60 seconds (to match optimistic message)
              created_at: {
                $gte: new Date(Date.now() - 60000).toISOString(),
              },
            },
          })
          .exec();
        
        log.debug('Looking for optimistic message candidates', {
          serverMessageId: message.id,
          serverContent: message.content,
          foundCount: messages.length,
          searchWindow: '60s'
        });

        // Find the closest match by content and timestamp
        const docs = (messages as unknown[]) as Array<{ toJSON: () => Message }>;
        
        // Filter by content (allow trimmed match)
        const matchingContentDocs = docs.filter(d => {
          const json = d.toJSON();
          return json.content.trim() === message.content.trim();
        });

        if (matchingContentDocs.length > 0) {
          // Sort by created_at difference and return closest
          const messageTime = new Date(message.created_at).getTime();
          const sorted = matchingContentDocs
            .map((m) => {
              const json = m.toJSON();
              return {
                doc: m,
                diff: Math.abs(new Date(json.created_at).getTime() - messageTime),
              };
            })
            .sort((a, b) => a.diff - b.diff);
          
          return sorted[0]?.doc || null;
        }
        
        // If no content match, log warning
        if (docs.length > 0) {
          log.warn('Found pending messages but content did not match', {
            serverContent: message.content,
            pendingContents: docs.map(d => d.toJSON().content)
          });
        }
        
        return null;
      }) as unknown) as { toJSON: () => Message } | null;
      
      if (optimisticMessage) {
        // Found optimistic message - update it with server ID and sync status
        const optimisticData = (optimisticMessage as unknown as { toJSON: () => Message }).toJSON() as Message;
        const optimisticId = optimisticData.id;
        log.info('Updating optimistic message with server ID', {
          optimisticId,
          serverId: message.id,
        });
        
        // Remove old optimistic message and store server message
        yield call(async () => {
          const doc = optimisticMessage as unknown as { remove: () => Promise<void> };
          await doc.remove();
          await db.messages.upsert(message);
        });
        
        // Don't manually update Redux state here - watchGroupMessages subscription will detect
        // the change (remove + upsert) and emit the updated messages array via setMessages
        // This ensures messages are always correctly sorted by RxDB query
        return;
      } else {
        log.warn('Optimistic message not found for own message', {
          messageId: message.id,
          content: message.content
        });
      }
    }
    
    // Not our own message or no optimistic message found - store normally
    // WebSocket messages are already synced (sync_status='synced')
    // REST API messages will have sync_status='pending' and be synced via replication
    // Just upsert to RxDB - watchGroupMessages will detect the change and update Redux via setMessages
    yield call(async () => {
      await db.messages.upsert(message);
    });
    
    // Don't call addMessage here - watchGroupMessages subscription will emit the updated messages array
    // and setMessages will update Redux state with the correctly sorted messages
  } catch (error) {
    log.error('Failed to receive message', error);
  }
}

// Track syncing messages state to prevent duplicate calls
const syncingMessages = new Set<string>();

function* watchSyncMessages() {
  yield takeEvery(SYNC_MESSAGES, handleSyncMessages);
}

function* handleSyncMessages(action: { type: string; payload: string }): Generator<unknown, void, unknown> {
  const groupId = action.payload;
  
  // Prevent duplicate syncs for the same group
  if (syncingMessages.has(groupId)) {
    log.debug('Skipping duplicate message sync', { groupId });
    return;
  }
  
  syncingMessages.add(groupId);
  
  try {
    // Don't set loading state - messages will appear naturally from RxDB subscription
    // Load messages from RxDB
    const db = (yield call(getDatabase) as unknown) as Awaited<ReturnType<typeof getDatabase>>;
    const messagesQuery = db.messages.find({
      selector: { group_id: groupId },
      sort: [{ created_at: 'asc' }],
    });
    const messageDocs = (yield call(() => messagesQuery.exec()) as unknown) as Array<{ toJSON: () => unknown }>;
    const messageArray = messageDocs.map((doc) => {
      const json = doc.toJSON();
      return json as Message;
    });
    
    // Update Redux state
    yield put({
      type: 'messages/setMessages',
      payload: { groupId, messages: messageArray },
    });
  } catch (error) {
    log.error('Failed to sync messages', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    yield put(
      setMessagesError({
        groupId,
        error: errorMessage,
      })
    );
  } finally {
    syncingMessages.delete(groupId);
  }
}

// Helper function to send text message
export const sendTextMessageAction = (groupId: string, content: string) =>
  sendMessageAction({
    group_id: groupId,
    content,
    message_type: 'text',
  });

// Helper function to send SOS message
export const sendSOSMessageAction = (
  groupId: string,
  sosType: 'medical' | 'flood' | 'fire' | 'missing_person',
  content?: string
) =>
  sendMessageAction({
    group_id: groupId,
    content: content || '',
    message_type: 'sos',
    sos_type: sosType,
    tags: ['urgent'],
  });

/**
 * Watch for WebSocket reconnection to send queued messages
 */
function* watchWebSocketReconnectionForQueuedMessages(): Generator<unknown, void, unknown> {
  while (true) {
    // Wait for WebSocket to become connected
    yield take((action: { type: string; payload?: unknown }) => {
      return (
        action.type === 'websocket/setWebSocketStatus' && action.payload === 'connected'
      );
    });
    
    // Get pending messages
    const state = (yield select() as unknown) as { messages: { pendingMessages: Array<{ message: Message; timestamp: string; retryCount: number }> } };
    const pendingMessages = state.messages.pendingMessages;
    
    if (pendingMessages.length > 0) {
      log.info('Sending queued messages on reconnection', { count: pendingMessages.length });
      
      // Send each pending message via WebSocket
      for (const pending of pendingMessages) {
        try {
          const message = pending.message;
          
          // Send via WebSocket
          yield put(
            sendWebSocketMessageAction({
              type: 'send_message',
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
          
          // Remove from queue after successful send
          yield put(removePendingMessage(message.id));
          log.debug('Queued message sent successfully', { messageId: message.id });
        } catch (error) {
          log.error('Failed to send queued message', error, { messageId: pending.message.id });
          // Keep message in queue for retry
        }
      }
    }
  }
}

// Track active subscriptions (task references)
const activeSubscriptions = new Map<string, Task>();
const activePinnedSubscriptions = new Map<string, Task>();

/**
 * Watch for message subscription requests
 */
function* watchStartMessageSubscription() {
  yield takeEvery(START_MESSAGE_SUBSCRIPTION, handleStartMessageSubscription);
}

function* handleStartMessageSubscription(action: { type: string; payload: { groupId: string; limit?: number } }) {
  const { groupId, limit } = action.payload;
  
  // Cancel existing subscription if any
  const existingTask = activeSubscriptions.get(groupId);
  if (existingTask) {
    yield cancel(existingTask);
  }
  
  const existingPinnedTask = activePinnedSubscriptions.get(groupId);
  if (existingPinnedTask) {
    yield cancel(existingPinnedTask);
  }
  
  // Start new subscriptions
  const task: Task = yield fork(watchGroupMessagesSubscription, groupId, limit);
  activeSubscriptions.set(groupId, task);

  const pinnedTask: Task = yield fork(watchGroupPinnedMessagesSubscription, groupId);
  activePinnedSubscriptions.set(groupId, pinnedTask);
}

/**
 * Watch for message subscription stop requests
 */
function* watchStopMessageSubscription() {
  yield takeEvery(STOP_MESSAGE_SUBSCRIPTION, handleStopMessageSubscription);
}

function* handleStopMessageSubscription(action: { type: string; payload: { groupId: string } }) {
  const { groupId } = action.payload;
  
  const task = activeSubscriptions.get(groupId);
  if (task) {
    yield cancel(task);
    activeSubscriptions.delete(groupId);
  }

  const pinnedTask = activePinnedSubscriptions.get(groupId);
  if (pinnedTask) {
    yield cancel(pinnedTask);
    activePinnedSubscriptions.delete(groupId);
  }
}

// ... existing watchGroupMessagesSubscription ...

/**
 * Watch RxDB pinned messages for a group and update Redux state
 */
function* watchGroupPinnedMessagesSubscription(groupId: string) {
  try {
    const channel: EventChannel<PinnedMessage[]> = yield call(createPinnedMessageEventChannel, groupId);
    
    while (true) {
      const pinnedMessages: PinnedMessage[] = yield take(channel);
      
      // Transform to Redux format
      const db = (yield call(getDatabase) as unknown) as Awaited<ReturnType<typeof getDatabase>>;
      const messageIds = pinnedMessages.map((pin) => pin.message_id);
      
      const messageDocs = messageIds.length > 0
        ? (yield call(async () => {
            const results = await Promise.all(
              messageIds.map((id) => db.messages.findOne(id).exec())
            );
            return results.filter((doc) => doc !== null);
          }) as unknown) as Array<{ toJSON: () => Message }>
        : [];
      
      // Create a map for faster lookup
      const messageMap = new Map<string, Message>();
      messageDocs.forEach(doc => {
        const msg = doc.toJSON() as Message;
        messageMap.set(msg.id, msg);
      });

      const transformedPinned = pinnedMessages
        .map(pin => {
          const message = messageMap.get(pin.message_id);
          if (!message) return null;
          return {
            message,
            pinned_at: pin.pinned_at,
            pinned_by_device_id: pin.device_id,
          };
        })
        .filter((item): item is { message: Message; pinned_at: string; pinned_by_device_id: string } => item !== null);
      
      yield put(setPinnedMessages({ groupId, pinnedMessages: transformedPinned }));
    }
  } catch (error) {
    log.error('Failed to setup pinned message subscription', error, { groupId });
  } finally {
    const isCancelled: boolean = (yield cancelled()) as unknown as boolean;
    if (isCancelled) {
      // Cleanup if needed
    }
  }
}

/**
 * Create an event channel for RxDB pinned message subscription
 */
function createPinnedMessageEventChannel(groupId: string): EventChannel<PinnedMessage[]> {
  return eventChannel<PinnedMessage[]>((emit) => {
    let unsubscribe: (() => void) | null = null;
    let isActive = true;
    
    watchPinnedMessages(groupId, (pinnedMessages: PinnedMessage[]) => {
      if (!isActive) return;
      emit(pinnedMessages);
    }).then((unsub) => {
      if (isActive) {
        unsubscribe = unsub;
      } else if (unsub) {
        unsub();
      }
    }).catch((err) => {
      log.error('Failed to create pinned message subscription', err, { groupId });
      if (isActive) {
        emit([]);
      }
    });
    
    return () => {
      isActive = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  });
}

// ... rest of the file ...

/**
 * Watch RxDB messages for a group and update Redux state
 * Uses debouncing to batch multiple rapid updates for better performance
 */
function* watchGroupMessagesSubscription(groupId: string, limit?: number) {
  try {
    // Create event channel for RxDB subscription
    const channel: EventChannel<Message[]> = yield call(createMessageEventChannel, groupId, limit);
    
    // Debounce buffer: accumulate messages updates and batch them
    let pendingMessages: Message[] | null = null;
    let debounceTask: Task | null = null;
    
    const flushPending = function* () {
      if (pendingMessages !== null) {
        const messagesToUpdate = pendingMessages;
        pendingMessages = null;
        debounceTask = null;
        yield put(setMessages({ groupId, messages: messagesToUpdate }));
      }
    };
    
    try {
      while (true) {
        const messages: Message[] = yield take(channel);
        
        // Store pending messages
        pendingMessages = messages;
        
        // Cancel previous debounce task if exists
        if (debounceTask) {
          yield cancel(debounceTask);
        }
        
        // Create new debounce task (50ms delay to batch rapid updates)
        debounceTask = yield fork(function* () {
          yield delay(50);
          yield* flushPending();
        });
      }
    } finally {
      const isCancelled: boolean = (yield cancelled()) as unknown as boolean;
      
      // Cancel debounce task if exists
      if (debounceTask) {
        yield cancel(debounceTask);
      }
      
      // Flush any pending messages before closing
      if (pendingMessages !== null) {
        yield* flushPending();
      }
      
      if (isCancelled) {
        channel.close();
      }
    }
  } catch (error) {
    log.error('Failed to setup message subscription', error, { groupId });
  }
}

/**
 * Create an event channel for RxDB message subscription
 */
function createMessageEventChannel(groupId: string, limit?: number): EventChannel<Message[]> {
  return eventChannel<Message[]>((emit) => {
    let unsubscribe: (() => void) | null = null;
    let isActive = true;
    
    // Setup RxDB subscription asynchronously
    watchGroupMessages(groupId, (messageArray: Message[]) => {
      if (!isActive) return;
      
      // Apply limit if specified
      const limitedMessages = limit ? messageArray.slice(-limit) : messageArray;
      emit(limitedMessages);
    }).then((unsub) => {
      if (isActive) {
        unsubscribe = unsub;
      } else if (unsub) {
        // If channel was closed before subscription was ready, cleanup immediately
        unsub();
      }
    }).catch((err) => {
      log.error('Failed to create message subscription', err, { groupId });
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

function* watchFetchPinnedMessages() {
  yield takeEvery(FETCH_PINNED_MESSAGES, handleFetchPinnedMessages);
}

function* handleFetchPinnedMessages(action: { type: string; payload: { groupId: string } }): Generator<unknown, void, unknown> {
  const { groupId } = action.payload;
  
  try {
    yield put(setPinnedMessagesLoading({ groupId, isLoading: true }));
    yield put(setPinnedMessagesError({ groupId, error: null }));
    
    // Read pinned messages from RxDB (synced via replication)
    const pinnedMessages = (yield call(getPinnedMessages, groupId)) as PinnedMessage[];
    
    // If no pinned messages found, trigger pull replication to ensure we have latest data
    // This ensures all data flows through RxDB, not direct API calls
    if (pinnedMessages.length === 0) {
      log.debug('No pinned messages in RxDB, triggering pull replication', { groupId });
      // Pull pinned_messages replication (will update RxDB, which triggers listener)
      yield call(pullDocuments, ['pinned_messages'], [groupId]);
      
      // Read again after pull
      const pinnedMessagesAfterPull = (yield call(getPinnedMessages, groupId)) as PinnedMessage[];
      
      // Transform PinnedMessage[] to { message: Message; pinned_at: string }[]
      const db = (yield call(getDatabase) as unknown) as Awaited<ReturnType<typeof getDatabase>>;
      const messageIds = pinnedMessagesAfterPull.map((pin) => pin.message_id);
      const messageDocs = messageIds.length > 0
        ? (yield call(async () => {
            const results = await Promise.all(
              messageIds.map((id) => db.messages.findOne(id).exec())
            );
            return results.filter((doc) => doc !== null);
          }) as unknown) as Array<{ toJSON: () => Message }>
        : [];
      
      const transformedPinned = messageDocs.map((doc, index) => ({
        message: doc.toJSON() as Message,
        pinned_at: pinnedMessagesAfterPull[index]?.pinned_at || new Date().toISOString(),
        pinned_by_device_id: pinnedMessagesAfterPull[index]?.device_id || "unknown",
      }));
      
      yield put(setPinnedMessages({ groupId, pinnedMessages: transformedPinned }));
    } else {
      // Transform PinnedMessage[] to { message: Message; pinned_at: string }[]
      const db = (yield call(getDatabase) as unknown) as Awaited<ReturnType<typeof getDatabase>>;
      const messageIds = pinnedMessages.map((pin) => pin.message_id);
      const messageDocs = messageIds.length > 0
        ? (yield call(async () => {
            const results = await Promise.all(
              messageIds.map((id) => db.messages.findOne(id).exec())
            );
            return results.filter((doc) => doc !== null);
          }) as unknown) as Array<{ toJSON: () => Message }>
        : [];
      
      const transformedPinned = messageDocs.map((doc, index) => ({
        message: doc.toJSON() as Message,
        pinned_at: pinnedMessages[index]?.pinned_at || new Date().toISOString(),
        pinned_by_device_id: pinnedMessages[index]?.device_id || "unknown",
      }));
      
      yield put(setPinnedMessages({ groupId, pinnedMessages: transformedPinned }));
    }
  } catch (error) {
    log.error('Failed to fetch pinned messages', error, { groupId });
    yield put(setPinnedMessagesError({
      groupId,
      error: error instanceof Error ? error.message : 'Failed to fetch pinned messages',
    }));
  } finally {
    yield put(setPinnedMessagesLoading({ groupId, isLoading: false }));
  }
}

/**
 * Root message saga
 * 
 * Debouncing/Throttling Patterns:
 * - takeEvery + duplicate prevention: Used for syncMessages (tracks in-progress syncs by groupId)
 * - takeEvery: Used for sendMessage, receiveMessage, subscriptions (process all actions)
 */
// Root saga
export function* messageSaga() {
  yield fork(watchSendMessage);
  yield fork(watchReceiveMessage);
  yield fork(watchSyncMessages);
  yield fork(watchStartMessageSubscription);
  yield fork(watchStopMessageSubscription);
  yield fork(watchWebSocketReconnectionForQueuedMessages);
  yield fork(watchFetchPinnedMessages);
}
