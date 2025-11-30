import { call, put, takeEvery, select, take } from 'redux-saga/effects';
import type { Message, MessageCreateRequest } from '@/domain/message';
import { createMessage } from '@/services/message-service';
import { getDatabase } from '@/services/db';
import {
  addMessage,
  setMessagesLoading,
  setMessagesError,
  markMessageReceived,
  queuePendingMessage,
  removePendingMessage,
} from '../slices/messagesSlice';
import { selectIsWebSocketConnected } from '../slices/websocketSlice';
import { sendWebSocketMessageAction } from './websocketSaga';
import { log } from '@/lib/logging/logger';

// Action types
const SEND_MESSAGE = 'messages/sendMessage';
const RECEIVE_MESSAGE = 'messages/receiveMessage';
const SYNC_MESSAGES = 'messages/syncMessages';

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
        // Message will be marked as synced when WebSocket confirms (message_sent event)
        // If WebSocket fails, message remains with sync_status='pending' and will be synced via REST
      } catch (wsError) {
        log.error('Failed to send message via WebSocket, will fall back to REST API', wsError);
        // Message already has sync_status='pending', replication sync will handle it
        yield put(queuePendingMessage(message));
      }
    } else {
      // WebSocket not connected - message will be synced via REST API replication
      // Message already has sync_status='pending', replication sync will push it
      yield put(queuePendingMessage(message));
      log.debug('WebSocket not connected, message will sync via REST API', { messageId: message.id });
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
    
    // Check for duplicates
    const state = (yield select() as unknown) as { messages: { receivedMessageIds: string[] } };
    const alreadyReceived = state.messages.receivedMessageIds.includes(message.id);
    if (alreadyReceived) {
      log.debug('Duplicate message received, skipping', { messageId: message.id });
      return;
    }
    
    // Mark as received
    yield put(markMessageReceived(message.id));
    
    // Store in RxDB
    // WebSocket messages are already synced (sync_status='synced')
    // REST API messages will have sync_status='pending' and be synced via replication
    const db = (yield call(getDatabase) as unknown) as Awaited<ReturnType<typeof getDatabase>>;
    yield call(async () => {
      await db.messages.upsert(message);
    });
    
    // Add to Redux state (will be sorted by created_at + device_sequence)
    yield put(addMessage({ groupId: message.group_id, message }));
  } catch (error) {
    log.error('Failed to receive message', error);
  }
}

function* watchSyncMessages() {
  yield takeEvery(SYNC_MESSAGES, handleSyncMessages);
}

function* handleSyncMessages(action: { type: string; payload: string }): Generator<unknown, void, unknown> {
  const groupId = action.payload;
  try {
    yield put(setMessagesLoading({ groupId, isLoading: true }));
    
    // Load messages from RxDB
    const db = (yield call(getDatabase) as unknown) as Awaited<ReturnType<typeof getDatabase>>;
    const messagesQuery = db.messages.find({
      selector: { group_id: groupId },
      sort: [{ created_at: 'asc' }],
    });
    const messageDocs = (yield call(() => messagesQuery.exec()) as unknown) as any[];
    const messageArray = messageDocs.map((doc: any) => {
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
    yield take((action: any) => {
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

// Root saga
export function* messageSaga() {
  yield watchSendMessage();
  yield watchReceiveMessage();
  yield watchSyncMessages();
  yield watchWebSocketReconnectionForQueuedMessages();
}
