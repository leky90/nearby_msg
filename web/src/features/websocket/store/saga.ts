/**
 * WebSocket Saga
 * Manages WebSocket connection lifecycle and message handling
 */

import { call, put, takeEvery, take, select, fork, cancel } from 'redux-saga/effects';
import type { Message } from "@/shared/domain/message";
import { eventChannel, type EventChannel, type Task } from 'redux-saga';
import type { WebSocketMessage, NewMessagePayload, MessageSentPayload, ErrorPayload } from "@/features/websocket/services/websocket";
import { createWebSocketService, getWebSocketUrl, type WebSocketService } from "@/features/websocket/services/websocket";
import { updateMessageSyncStatus } from "@/shared/services/db";
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
} from './slice';
import { selectJWTToken } from '@/features/device/store/slice';
import { receiveMessageAction } from '@/features/messages/store/saga';
import { log } from "@/shared/lib/logging/logger";

// Action types
const CONNECT_WEBSOCKET = 'websocket/connect';
const DISCONNECT_WEBSOCKET = 'websocket/disconnect';
const SUBSCRIBE_TO_GROUPS = 'websocket/subscribeToGroups';
const UNSUBSCRIBE_FROM_GROUPS = 'websocket/unsubscribeFromGroups';
const SEND_WEBSOCKET_MESSAGE = 'websocket/sendMessage';

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

// WebSocket service instance (singleton)
let wsService: WebSocketService | null = null;
let messageChannel: EventChannel<WebSocketMessage> | null = null;
let messageChannelTask: Task<unknown> | null = null;

/**
 * Create event channel for WebSocket messages
 */
function createWebSocketChannel(service: WebSocketService): EventChannel<WebSocketMessage> {
  return eventChannel<WebSocketMessage>((emitter) => {
    service.setCallbacks({
      onMessage: (message) => {
        emitter(message);
      },
      onError: (error) => {
        log.error('WebSocket error in channel', error);
        emitter({ type: 'error', payload: { error: 'WebSocket error' } });
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
      log.warn('Cannot connect WebSocket: No JWT token');
      yield put(setWebSocketError('No authentication token'));
      return;
    }

    // Set connecting status
    yield put(setWebSocketStatus('connecting'));
    yield put(setWebSocketError(null));

    // Create or reuse WebSocket service
    if (!wsService) {
      wsService = createWebSocketService(token);
      const url = getWebSocketUrl();
      yield put(setWebSocketUrl(url));
    }

    // Set up callbacks and connect
    if (!wsService) {
      throw new Error('WebSocket service not created');
    }
    
    const service = wsService; // Capture for type narrowing
    
    // Set up callbacks BEFORE connecting
    // onOpen callback will update status when connection is actually established
    service.setCallbacks({
      onOpen: () => {
        log.info('WebSocket connected - updating status');
        // Update status when connection is actually established
        // Use put directly in callback (saga will handle it)
        // Note: We need to dispatch action, but we're in a callback
        // The status will be updated via the promise resolution below
      },
      onClose: (event) => {
        log.info('WebSocket closed', { code: event.code, reason: event.reason });
        // Update status when connection closes
        // This will be handled by the service's onClose callback
      },
      onError: (error) => {
        log.error('WebSocket error', error);
      },
    });

    // Connect and wait for connection to be established
    yield call(() => service.connect());

    // After connect() resolves, connection is established
    // Update status now that we're actually connected
    yield put(setWebSocketStatus('connected'));
    yield put(setConnectedAt(new Date().toISOString()));
    yield put(resetReconnectAttempts());
    log.info('WebSocket status set to connected in Redux');

    // Create message channel AFTER connection is established
    if (!messageChannel && wsService) {
      messageChannel = createWebSocketChannel(wsService);
      messageChannelTask = (yield fork(watchWebSocketMessages) as unknown) as Task<unknown>;
      log.info('WebSocket message channel created and started');
    }

    // Re-subscribe to previously subscribed groups
    const subscribedGroupIds = (yield select(selectSubscribedGroupIds) as unknown) as string[];
    
    // Also check if there's a current chat group that needs subscription
    const currentChatGroupId = (yield select((state: { navigation: { currentChatGroupId: string | null } }) =>
      state.navigation?.currentChatGroupId
    )) as unknown as string | null | undefined;
    
    const groupsToSubscribe = new Set<string>(subscribedGroupIds);
    if (currentChatGroupId && !groupsToSubscribe.has(currentChatGroupId)) {
      groupsToSubscribe.add(currentChatGroupId);
      log.info('Found current chat group, adding to subscription', { groupId: currentChatGroupId });
    }
    
    if (groupsToSubscribe.size > 0) {
      const groupsArray = Array.from(groupsToSubscribe);
      log.info('Subscribing to groups after connection', { 
        groupIds: groupsArray,
        fromPrevious: subscribedGroupIds,
        fromCurrentChat: currentChatGroupId,
      });
      yield put(subscribeToGroupsAction(groupsArray));
    } else {
      log.debug('No groups to subscribe after connection', {
        subscribedGroupIds: subscribedGroupIds.length,
        currentChatGroupId: currentChatGroupId || null,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Connection failed';
    const errorDetails = error instanceof Error ? {
      name: error.name,
      stack: error.stack?.substring(0, 200),
    } : {};
    
    log.error('Failed to connect WebSocket', error, {
      errorMessage,
      ...errorDetails,
      reconnectAttempts: (yield select((state: { websocket: { reconnectAttempts: number } }) => state.websocket.reconnectAttempts) as unknown) as number,
    });
    
    yield put(setWebSocketStatus('error'));
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
      log.info('Will attempt automatic reconnection', {
        attempt: reconnectAttempts + 1,
        maxAttempts: maxReconnectAttempts
      });
      // Reconnection will be handled by watchWebSocketReconnect saga
    } else {
      log.warn('Cannot reconnect automatically', {
        hasToken: !!token,
        reconnectAttempts,
        maxAttempts: maxReconnectAttempts
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
    if (messageChannelTask) {
      yield cancel(messageChannelTask);
      messageChannelTask = null;
    }

    if (messageChannel) {
      messageChannel.close();
      messageChannel = null;
    }

    if (wsService) {
      wsService.disconnect();
      wsService = null;
    }

    yield put(setWebSocketStatus('disconnected'));
    yield put(setDisconnectedAt(new Date().toISOString()));
  } catch (error) {
    log.error('Failed to disconnect WebSocket', error);
  }
}

/**
 * Watch for WebSocket messages via event channel
 */
function* watchWebSocketMessages(): Generator<unknown, void, unknown> {
  if (!messageChannel) {
    return;
  }

  try {
    while (true) {
      const message = (yield take(messageChannel)) as WebSocketMessage;
      // Handle message directly (no need to fork for simple message handling)
      yield* handleWebSocketMessage(message);
    }
  } catch (error) {
    log.error('Error in WebSocket message channel', error);
  } finally {
    if (messageChannel) {
      messageChannel.close();
      messageChannel = null;
    }
  }
}

/**
 * Handle incoming WebSocket message
 */
function* handleWebSocketMessage(message: WebSocketMessage): Generator<unknown, void, unknown> {
  try {
    log.debug('Handling WebSocket message', {
      type: message.type,
      hasPayload: !!message.payload,
    });
    
    switch (message.type) {
      case 'new_message': {
        // Convert WebSocket message format to domain Message format
        const domainMessage = convertWebSocketMessageToDomain(message);
        log.info('Received new message via WebSocket', {
          messageId: domainMessage.id,
          groupId: domainMessage.group_id,
          content: domainMessage.content.substring(0, 50),
        });
        yield put(receiveMessageAction(domainMessage));
        break;
      }

      case 'message_sent':
        // Message sent confirmation - mark message as synced in RxDB
        log.debug('Message sent confirmation', message.payload);
        if (
          typeof message.payload === 'object' &&
          message.payload !== null &&
          ('messageId' in message.payload || 'serverMessageId' in message.payload)
        ) {
          yield* handleMessageSentConfirmation(message.payload as MessageSentPayload);
        }
        break;

      case 'message_error':
        log.error('Message error from server', message.payload);
        if (
          typeof message.payload === 'object' &&
          message.payload !== null &&
          'error' in message.payload
        ) {
          yield put(setWebSocketError((message.payload as ErrorPayload).error || 'Message error'));
        }
        break;

      case 'subscribed':
        log.debug('Subscribed to groups', message.payload);
        break;

      case 'unsubscribed':
        log.debug('Unsubscribed from groups', message.payload);
        break;

      case 'pong':
        // Heartbeat response - connection is alive
        log.debug('Received pong', message.payload);
        break;

      case 'error':
        log.error('WebSocket error message', message.payload);
        if (
          typeof message.payload === 'object' &&
          message.payload !== null &&
          'error' in message.payload
        ) {
          yield put(setWebSocketError((message.payload as ErrorPayload).error || 'WebSocket error'));
        }
        break;

      default:
        log.warn('Unknown WebSocket message type', { type: message.type });
    }
  } catch (error) {
    log.error('Failed to handle WebSocket message', error, { message });
  }
}

/**
 * Handle message sent confirmation from WebSocket
 * Marks the message as synced in RxDB
 */
function* handleMessageSentConfirmation(payload: { serverMessageId?: string; messageId?: string }): Generator<unknown, void, unknown> {
  try {
    const { serverMessageId, messageId } = payload;
    const targetMessageId = messageId || serverMessageId;
    
    if (!targetMessageId) {
      log.warn('No message ID provided in confirmation', payload);
      return;
    }
    
    // Mark message as synced using the service function
    yield call(updateMessageSyncStatus, targetMessageId, 'synced', new Date().toISOString());
    log.debug('Message marked as synced via WebSocket', { messageId: targetMessageId });
  } catch (error) {
    log.error('Failed to mark message as synced', error);
  }
}

/**
 * Convert WebSocket message format to domain Message format
 */
function convertWebSocketMessageToDomain(wsMessage: WebSocketMessage): Message {
  const payload = wsMessage.payload;
  
  // Type guard: ensure payload is NewMessagePayload
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'id' in payload &&
    'groupId' in payload &&
    'deviceId' in payload &&
    'content' in payload
  ) {
    const newMessagePayload = payload as NewMessagePayload;
    return {
      id: newMessagePayload.id,
      group_id: newMessagePayload.groupId,
      device_id: newMessagePayload.deviceId,
      content: newMessagePayload.content,
      message_type: newMessagePayload.messageType,
      sos_type: newMessagePayload.sosType,
      tags: newMessagePayload.tags,
      pinned: newMessagePayload.pinned ?? false,
      created_at: newMessagePayload.createdAt,
      device_sequence: newMessagePayload.deviceSequence,
      sync_status: 'synced' as const,
    };
  }
  
  // Fallback - should not happen for new_message type
  throw new Error('Invalid payload type for new_message');
}

/**
 * Watch for subscribe to groups
 */
function* watchSubscribeToGroups(): Generator<unknown, void, unknown> {
  yield takeEvery(SUBSCRIBE_TO_GROUPS, handleSubscribeToGroups);
}

function* handleSubscribeToGroups(action: { type: string; payload: string[] }): Generator<unknown, void, unknown> {
  const groupIds = action.payload;
  
  log.info('handleSubscribeToGroups called', {
    groupIds,
    hasService: !!wsService,
    isConnected: wsService?.isConnected(),
    status: wsService?.getStatus(),
  });
  
  if (!wsService) {
    log.error('Cannot subscribe: WebSocket service not initialized', { groupIds });
    return;
  }
  
  if (!wsService.isConnected()) {
    log.warn('Cannot subscribe: WebSocket not connected', {
      isConnected: wsService.isConnected(),
      status: wsService.getStatus(),
      groupIds,
    });
    return;
  }

  try {
    // Update Redux state first
    for (const groupId of groupIds) {
      yield put(subscribeToGroup(groupId));
    }
    log.info('Subscribed to groups in Redux', { groupIds });

    // Send subscribe message to server
    const subscribeMessage = {
      type: 'subscribe' as const,
      payload: { groupIds },
    };
    log.info('Sending subscribe message to server', { groupIds, message: subscribeMessage });
    wsService.send(subscribeMessage);
    log.info('Subscribe message sent successfully to server', { groupIds });
  } catch (error) {
    log.error('Failed to subscribe to groups', error, { groupIds });
    // Remove from Redux state on error
    for (const groupId of groupIds) {
      yield put(unsubscribeFromGroup(groupId));
    }
  }
}

/**
 * Watch for unsubscribe from groups
 */
function* watchUnsubscribeFromGroups(): Generator<unknown, void, unknown> {
  yield takeEvery(UNSUBSCRIBE_FROM_GROUPS, handleUnsubscribeFromGroups);
}

function* handleUnsubscribeFromGroups(action: { type: string; payload: string[] }): Generator<unknown, void, unknown> {
  const groupIds = action.payload;
  
  if (!wsService || !wsService.isConnected()) {
    log.warn('Cannot unsubscribe: WebSocket not connected');
    return;
  }

  try {
    // Update Redux state
    for (const groupId of groupIds) {
      yield put(unsubscribeFromGroup(groupId));
    }

    // Send unsubscribe message to server
    wsService.send({
      type: 'unsubscribe',
      payload: { groupIds },
    });
  } catch (error) {
    log.error('Failed to unsubscribe from groups', error);
  }
}

/**
 * Watch for send WebSocket message
 */
function* watchSendWebSocketMessage(): Generator<unknown, void, unknown> {
  yield takeEvery(SEND_WEBSOCKET_MESSAGE, handleSendWebSocketMessage);
}

function* handleSendWebSocketMessage(action: { type: string; payload: WebSocketMessage }): Generator<unknown, void, unknown> {
  const message = action.payload;
  
  if (!wsService) {
    const error = new Error('WebSocket service not initialized');
    log.error('Cannot send message: WebSocket service not initialized', {
      messageType: message.type,
    });
    yield put(setWebSocketError('WebSocket service not initialized'));
    yield put(setWebSocketStatus('error'));
    throw error;
  }
  
  if (!wsService.isConnected()) {
    const error = new Error('WebSocket not connected');
    log.warn('Cannot send message: WebSocket not connected', {
      messageType: message.type,
      status: wsService.getStatus(),
      isConnected: wsService.isConnected(),
    });
    
    // Update error state
    yield put(setWebSocketError('Cannot send message: WebSocket not connected'));
    yield put(setWebSocketStatus('error'));
    
    throw error;
  }

  try {
    log.debug('Sending WebSocket message', {
      type: message.type,
      payload: message.payload,
    });
    wsService.send(message);
    log.info('WebSocket message sent successfully', {
      type: message.type,
      hasPayload: !!message.payload,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
    log.error('Failed to send WebSocket message', error, {
      messageType: message.type,
      errorMessage,
      status: wsService.getStatus(),
    });
    
    // Update error state
    yield put(setWebSocketError(errorMessage));
    yield put(setWebSocketStatus('error'));
    
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
    const action = (yield take((a: { type: string; payload?: unknown }) =>
      a.type === 'websocket/setWebSocketStatus' &&
      (a.payload === 'disconnected' || a.payload === 'error')
    )) as { type: string; payload?: unknown };

    const status = action.payload;
    if (status !== 'disconnected' && status !== 'error') {
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
      log.info('Scheduling WebSocket reconnection', { attempt: reconnectAttempts + 1, delay });
      
      yield call(() => new Promise((resolve) => setTimeout(resolve, delay)));
      
      // Attempt reconnection
      yield put(connectWebSocketAction());
    } else if (!token) {
      log.warn('Cannot reconnect: No JWT token');
    } else {
      log.warn('Max reconnection attempts reached', { attempts: reconnectAttempts });
    }
  }
}

/**
 * Watch for WebSocket errors
 */
function* watchWebSocketError(): Generator<unknown, void, unknown> {
  yield takeEvery('websocket/setWebSocketError', handleWebSocketError);
}

function* handleWebSocketError(action: { type: string; payload: string | null }): Generator<unknown, void, unknown> {
  const error = action.payload;
  if (error) {
    log.error('WebSocket error occurred', { error });
    // Update status to error
    yield put(setWebSocketStatus('error'));
    // Increment reconnect attempts
    yield put(incrementReconnectAttempts());
    
    // Attempt reconnection if not already reconnecting
    const status = (yield select((state: { websocket: { status: string } }) => state.websocket.status) as unknown) as string;
    if (status !== 'connecting') {
      // Trigger reconnection attempt
      yield put(connectWebSocketAction());
    }
  }
}

// Root saga
export function* websocketSaga(): Generator<unknown, void, unknown> {
  yield watchWebSocketConnect();
  yield watchWebSocketDisconnect();
  yield watchWebSocketReconnect();
  yield watchWebSocketError();
  yield watchSubscribeToGroups();
  yield watchUnsubscribeFromGroups();
  yield watchSendWebSocketMessage();
}
