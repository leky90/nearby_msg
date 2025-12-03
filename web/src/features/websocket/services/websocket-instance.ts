/**
 * WebSocket Instance Manager
 * Manages singleton WebSocket service instance and related resources
 */

import type { EventChannel, Task } from 'redux-saga';
import type { WebSocketService, WebSocketMessage } from './websocket';
import { createWebSocketService, getWebSocketUrl } from './websocket';
import { log } from "@/shared/lib/logging/logger";

// WebSocket service instance (singleton)
let wsService: WebSocketService | null = null;
let messageChannel: EventChannel<WebSocketMessage> | null = null;
let messageChannelTask: Task<unknown> | null = null;

/**
 * Get or create WebSocket service instance
 */
export function getWebSocketService(): WebSocketService | null {
  return wsService;
}

/**
 * Create WebSocket service instance
 */
export function createWebSocketInstance(token: string): WebSocketService {
  if (wsService) {
    log.debug('WebSocket service already exists, reusing instance');
    return wsService;
  }

  log.info('Creating new WebSocket service instance', {
    url: getWebSocketUrl(),
    tokenPrefix: token.substring(0, 10) + '...',
  });

  wsService = createWebSocketService(token);
  return wsService;
}

/**
 * Set WebSocket service instance (for testing or manual setup)
 */
export function setWebSocketInstance(service: WebSocketService | null): void {
  wsService = service;
  if (!service) {
    log.debug('WebSocket service instance cleared');
  }
}

/**
 * Clear WebSocket service instance
 */
export function clearWebSocketInstance(): void {
  if (wsService) {
    log.info('Clearing WebSocket service instance');
    wsService.disconnect();
    wsService = null;
  }
}

/**
 * Get message channel
 */
export function getMessageChannel(): EventChannel<WebSocketMessage> | null {
  return messageChannel;
}

/**
 * Set message channel
 */
export function setMessageChannel(channel: EventChannel<WebSocketMessage> | null): void {
  messageChannel = channel;
  if (!channel) {
    log.debug('Message channel cleared');
  }
}

/**
 * Get message channel task
 */
export function getMessageChannelTask(): Task<unknown> | null {
  return messageChannelTask;
}

/**
 * Set message channel task
 */
export function setMessageChannelTask(task: Task<unknown> | null): void {
  messageChannelTask = task;
  if (!task) {
    log.debug('Message channel task cleared');
  }
}

/**
 * Clear all WebSocket resources
 */
export function clearAllWebSocketResources(): void {
  log.info('Clearing all WebSocket resources');
  
  if (messageChannelTask) {
    messageChannelTask = null;
  }
  
  if (messageChannel) {
    messageChannel.close();
    messageChannel = null;
  }
  
  clearWebSocketInstance();
}
