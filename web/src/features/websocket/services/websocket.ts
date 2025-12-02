/**
 * WebSocket Service
 * Low-level WebSocket connection management
 * Handles connection lifecycle, message sending/receiving, and reconnection
 */

import { log } from "@/shared/lib/logging/logger";

export type WebSocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * WebSocket message types
 */
export type WebSocketMessageType =
  | 'connect'
  | 'subscribe'
  | 'unsubscribe'
  | 'send_message'
  | 'new_message'
  | 'message_sent'
  | 'message_error'
  | 'subscribed'
  | 'unsubscribed'
  | 'ping'
  | 'pong'
  | 'error';

/**
 * WebSocket message payload types
 */
export interface SendMessagePayload {
  groupId: string;
  content: string;
  messageType: 'text' | 'sos';
  sosType?: 'medical' | 'flood' | 'fire' | 'missing_person';
  tags?: string[];
  deviceSequence?: number;
}

export interface NewMessagePayload {
  id: string;
  groupId: string;
  deviceId: string;
  content: string;
  messageType: 'text' | 'sos';
  sosType?: 'medical' | 'flood' | 'fire' | 'missing_person';
  tags?: string[];
  pinned?: boolean;
  createdAt: string;
  deviceSequence?: number;
}

export interface MessageSentPayload {
  messageId?: string;
  serverMessageId?: string;
}

export interface SubscribePayload {
  groupIds: string[];
}

export interface ErrorPayload {
  error: string;
  code?: string;
}

/**
 * WebSocket message interface
 */
export interface WebSocketMessage {
  type: WebSocketMessageType;
  payload: SendMessagePayload | NewMessagePayload | MessageSentPayload | SubscribePayload | ErrorPayload | Record<string, unknown>;
  timestamp?: string;
  messageId?: string;
}

export interface WebSocketCallbacks {
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (error: Event) => void;
  onMessage?: (message: WebSocketMessage) => void;
}

/**
 * WebSocket service class
 * Manages WebSocket connection lifecycle
 */
export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private callbacks: WebSocketCallbacks = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private readonly PING_INTERVAL = 30000; // 30 seconds

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.ws?.readyState === WebSocket.CONNECTING) {
        // Wait for connection
        const checkConnection = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            clearInterval(checkConnection);
            resolve();
          } else if (this.ws?.readyState === WebSocket.CLOSED) {
            clearInterval(checkConnection);
            reject(new Error('Connection failed'));
          }
        }, 100);
        return;
      }

      try {
        const wsUrl = `${this.url}?token=${encodeURIComponent(this.token)}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          log.info('WebSocket connected', { url: this.url, token: this.token.substring(0, 10) + '...' });
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          this.startPingInterval();
          this.callbacks.onOpen?.();
          resolve();
        };

        this.ws.onclose = (event) => {
          log.info('WebSocket closed', { 
            code: event.code, 
            reason: event.reason,
            wasClean: event.wasClean,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts
          });
          this.stopPingInterval();
          this.callbacks.onClose?.(event);
          
          // Attempt reconnection if not a normal closure
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            log.debug('Scheduling WebSocket reconnection', { 
              attempt: this.reconnectAttempts + 1,
              delay: this.reconnectDelay 
            });
            this.scheduleReconnect();
          } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            log.warn('Max WebSocket reconnection attempts reached', { 
              attempts: this.reconnectAttempts 
            });
          }
        };

        this.ws.onerror = (error) => {
          log.error('WebSocket error', error, {
            readyState: this.ws?.readyState,
            url: this.url,
            reconnectAttempts: this.reconnectAttempts
          });
          this.callbacks.onError?.(error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            log.debug('Received WebSocket message', {
              type: message.type,
              hasPayload: !!message.payload,
              timestamp: message.timestamp
            });
            this.callbacks.onMessage?.(message);
          } catch (err) {
            log.error('Failed to parse WebSocket message', err, { 
              data: typeof event.data === 'string' ? event.data.substring(0, 100) : 'non-string data'
            });
          }
        };
      } catch (error) {
        log.error('Failed to create WebSocket connection', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    log.info('Disconnecting WebSocket', {
      wasConnected: this.ws?.readyState === WebSocket.OPEN,
      reconnectAttempts: this.reconnectAttempts
    });

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPingInterval();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  /**
   * Send message to server
   */
  send(message: WebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      log.warn('Cannot send message: WebSocket not connected', {
        readyState: this.ws?.readyState,
        messageType: message.type
      });
      throw new Error('WebSocket not connected');
    }

    log.debug('Sending WebSocket message', {
      type: message.type,
      hasPayload: !!message.payload,
      timestamp: new Date().toISOString()
    });

    try {
      const json = JSON.stringify(message);
      this.ws.send(json);
    } catch (error) {
      log.error('Failed to send WebSocket message', error, {
        messageType: message.type
      });
      throw error;
    }
  }

  /**
   * Get current connection status
   */
  getStatus(): WebSocketStatus {
    if (!this.ws) {
      return 'disconnected';
    }

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        return 'disconnected';
      default:
        return 'error';
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Set callbacks for WebSocket events
   */
  setCallbacks(callbacks: WebSocketCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return; // Already scheduled
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    log.info('Scheduling WebSocket reconnection', {
      attempt: this.reconnectAttempts,
      delayMs: delay,
      nextAttemptIn: `${Math.round(delay / 1000)}s`,
      maxAttempts: this.maxReconnectAttempts
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      log.info('Attempting WebSocket reconnection', {
        attempt: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
        url: this.url
      });
      this.connect().catch((err) => {
        log.error('Reconnection failed', err, {
          attempt: this.reconnectAttempts,
          willRetry: this.reconnectAttempts < this.maxReconnectAttempts
        });
      });
    }, delay);
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    this.stopPingInterval();
    
    log.debug('Starting WebSocket ping interval', { intervalMs: this.PING_INTERVAL });
    
    this.pingInterval = setInterval(() => {
      if (this.isConnected()) {
        log.debug('Sending WebSocket ping');
        this.send({
          type: 'ping',
          payload: {
            timestamp: new Date().toISOString(),
          },
        });
      } else {
        log.warn('Skipping ping: WebSocket not open', { readyState: this.ws?.readyState });
      }
    }, this.PING_INTERVAL);
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      log.debug('Stopping WebSocket ping interval');
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

/**
 * Get WebSocket URL from environment or default
 * In development, uses proxy (relative URL)
 * In production, uses VITE_WS_URL or constructs from VITE_API_URL/VITE_API_HOST
 */
export function getWebSocketUrl(): string {
  // If VITE_WS_URL is explicitly set, use it (for production or custom setup)
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  // In development mode, use proxy (relative URL)
  if (import.meta.env.DEV) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws/messages`;
  }

  // Production: construct from VITE_API_URL or VITE_API_HOST
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    // Extract host from API URL and convert to WebSocket URL
    try {
      const url = new URL(apiUrl);
      const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${url.host}/ws/messages`;
    } catch {
      // If VITE_API_URL is not a valid URL, fall through to VITE_API_HOST
    }
  }

  // Use VITE_API_HOST if available
  const host = import.meta.env.VITE_API_HOST || window.location.host;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${host}/ws/messages`;
}

/**
 * Create WebSocket service instance
 */
export function createWebSocketService(token: string): WebSocketService {
  const url = getWebSocketUrl();
  return new WebSocketService(url, token);
}
