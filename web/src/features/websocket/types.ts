/**
 * WebSocket Feature Types
 * Type definitions for the websocket feature module
 */

export type WebSocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface WebSocketState {
  status: WebSocketStatus;
  connectedAt: number | null;
  disconnectedAt: number | null;
  lastError: string | null;
  reconnectAttempts: number;
  subscribedGroupIds: string[];
}
