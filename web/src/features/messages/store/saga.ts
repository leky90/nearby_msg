import { call, put, takeEvery, select, take, fork, cancel, cancelled } from 'redux-saga/effects';
import { eventChannel, type EventChannel, type Task } from 'redux-saga';
import type { Message, MessageCreateRequest } from "@/shared/domain/message";
import type { PinnedMessage } from "@/shared/domain/pinned_message";
import { createMessage } from "@/features/messages/services/message-service";
import { getPinnedMessages } from "@/features/messages/services/pin-service";
import { getDatabase, watchGroupMessages } from "@/shared/services/db";
import { pullDocuments } from "@/features/replication/services/replication-sync";
import { getOrCreateDeviceId } from "@/features/device/services/device-storage";
import {
  addMessage,
  setMessagesLoading,
  setMessagesError,
  markMessageReceived,
  queuePendingMessage,
  removePendingMessage,
  setMessages,
  setPinnedMessages,
  setPinnedMessagesLoading,
  setPinnedMessagesError,
} from './slice';
import { selectIsWebSocketConnected } from '@/features/websocket/store/slice';
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
    yield put(setMessagesLoading({ groupId: group_id, isLoading: true }));
    yield put(setMessagesError({ groupId: group_id, error: null }));
    
    // Check if WebSocket is connected
    const isWebSocketConnected: boolean = yield select(selectIsWebSocketConnected);
    
    // Create message (will be sent via WebSocket if connected, otherwise queued)
    const message: Message = yield call(createMessage, action.payload);
    
    // Add to Redux state immediately (optimistic update)
    yield put(addMessage({ groupId: group_id, message }));
    
    // Send via WebSocket if connected, otherwise fall back to REST API via replication
    if (isWebSocketConnected) {
      try {
        log.debug('Sending message via WebSocket', {
          messageId: message.id,
          groupId: group_id,
          content: message.content.substring(0, 50),
        });
        
        // Send message via WebSocket
        yield put(
          sendWebSocketMessageAction({
            type: 'send_message',
            payload: {
              groupId: group_id,
              content: action.payload.content,
              messageType: action.payload.message_type,
              sosType: action.payload.sos_type,
              tags: action.payload.tags,
              deviceSequence: action.payload.device_sequence,
            },
          })
        );
        
        log.debug('WebSocket message action dispatched', { messageId: message.id });
        // Message will be marked as synced when WebSocket confirms (message_sent event)
        // If WebSocket fails, message remains with sync_status='pending' and will be synced via REST
      } catch (wsError) {
        log.error('Failed to send message via WebSocket, will fall back to REST API', wsError, {
          messageId: message.id,
        });
        // Message already has sync_status='pending', replication sync will handle it
        yield put(queuePendingMessage(message));
      }
    } else {
      // WebSocket not connected - message will be synced via REST API replication
      // Message already has sync_status='pending', replication sync will push it
      yield put(queuePendingMessage(message));
      log.debug('WebSocket not connected, message will sync via REST API', {
        messageId: message.id,
        isWebSocketConnected,
      });
    }
    
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
  } finally {
    yield put(setMessagesLoading({ groupId: action.payload.group_id, isLoading: false }));
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
    yield put(markMessageReceived(message.id));
    
    const db = (yield call(getDatabase) as unknown) as Awaited<ReturnType<typeof getDatabase>>;
    const deviceId = (yield call(getOrCreateDeviceId) as unknown) as string;
    
    // Check if this is our own message (optimistic update scenario)
    // If we sent a message with client ID, server creates new message with server ID
    // We need to match and update the optimistic message
    if (message.device_id === deviceId) {
      // This might be our own message from server
      // Try to find optimistic message with same content, group, and similar timestamp
      const optimisticMessage = (yield call(async () => {
        const messages = await db.messages
          .find({
            selector: {
              group_id: message.group_id,
              device_id: deviceId,
              content: message.content,
              sync_status: 'pending',
              // Created within last 5 seconds (to match optimistic message)
              created_at: {
                $gte: new Date(Date.now() - 5000).toISOString(),
              },
            },
          })
          .exec();
        
        // Find the closest match by timestamp
        const docs = (messages as unknown[]) as Array<{ toJSON: () => Message }>;
        if (docs.length > 0) {
          // Sort by created_at difference and return closest
          const messageTime = new Date(message.created_at).getTime();
          const sorted = docs
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
        return null;
      }) as unknown) as { toJSON: () => Message } | null;
      
      if (optimisticMessage) {
        // Found optimistic message - update it with server ID and sync status
        const optimisticData = (optimisticMessage as unknown as { toJSON: () => Message }).toJSON() as Message;
        const optimisticId = optimisticData.id;
        log.debug('Updating optimistic message with server ID', {
          optimisticId,
          serverId: message.id,
        });
        
        // Remove old optimistic message and store server message
        yield call(async () => {
          const doc = optimisticMessage as unknown as { remove: () => Promise<void> };
          await doc.remove();
          await db.messages.upsert(message);
        });
        
        // Update Redux state - remove old message, add new one
        // First, remove old message from Redux
        const currentMessages = (yield select((state: { messages: { byGroupId: Record<string, { messages: Message[] }> } }) => 
          state.messages.byGroupId[message.group_id]?.messages || []
        )) as unknown as Message[];
        
        const filteredMessages = currentMessages.filter((m) => m.id !== optimisticId);
        
        // Set messages without the old optimistic one
        yield put(setMessages({ groupId: message.group_id, messages: filteredMessages }));
        
        // Add the new server message
        yield put(addMessage({ groupId: message.group_id, message }));
        return;
      }
    }
    
    // Not our own message or no optimistic message found - store normally
    // WebSocket messages are already synced (sync_status='synced')
    // REST API messages will have sync_status='pending' and be synced via replication
    yield call(async () => {
      await db.messages.upsert(message);
    });
    
    // Add to Redux state (will be sorted by created_at + device_sequence)
    yield put(addMessage({ groupId: message.group_id, message }));
  } catch (error) {
    log.error('Failed to receive message', error);
  }
}

// Track syncing messages state to prevent duplicate calls
const syncingMessages = new Set<string>();

/**
 * Watch for sync messages actions
 * Uses takeEvery with duplicate prevention to handle rapid calls
 */
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
    yield put(setMessagesLoading({ groupId, isLoading: true }));
    
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
    yield put(setMessagesLoading({ groupId, isLoading: false }));
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
  
  // Start new subscription
  const task: Task = yield fork(watchGroupMessagesSubscription, groupId, limit);
  activeSubscriptions.set(groupId, task);
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
}

/**
 * Watch RxDB messages for a group and update Redux state
 */
function* watchGroupMessagesSubscription(groupId: string, limit?: number) {
  try {
    // Create event channel for RxDB subscription
    const channel: EventChannel<Message[]> = yield call(createMessageEventChannel, groupId, limit);
    
    try {
      while (true) {
        const messages: Message[] = yield take(channel);
        // Update Redux state with messages (no debouncing - saga handles efficiently)
        yield put(setMessages({ groupId, messages }));
      }
    } finally {
      const isCancelled: boolean = (yield cancelled()) as unknown as boolean;
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
      yield put(setPinnedMessages({ groupId, pinnedMessages: pinnedMessagesAfterPull }));
    } else {
      yield put(setPinnedMessages({ groupId, pinnedMessages }));
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
