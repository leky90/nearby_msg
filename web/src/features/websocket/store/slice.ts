import { createSlice, type PayloadAction, createSelector } from '@reduxjs/toolkit';

export type WebSocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface WebSocketState {
  // Connection status
  status: WebSocketStatus;
  
  // Connection metadata
  connectedAt: string | null;
  disconnectedAt: string | null;
  lastError: string | null;
  
  // Reconnection state
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  
  // Subscribed groups
  subscribedGroupIds: string[]; // Array instead of Set for Redux serialization
  
  // Connection URL
  url: string | null;
}

const initialState: WebSocketState = {
  status: 'disconnected',
  connectedAt: null,
  disconnectedAt: null,
  lastError: null,
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  subscribedGroupIds: [],
  url: null,
};

const websocketSlice = createSlice({
  name: 'websocket',
  initialState,
  reducers: {
    setWebSocketStatus: (state, action: PayloadAction<WebSocketStatus>) => {
      state.status = action.payload;
    },
    setWebSocketError: (state, action: PayloadAction<string | null>) => {
      state.lastError = action.payload;
      if (action.payload) {
        state.status = 'error';
      }
    },
    setConnectedAt: (state, action: PayloadAction<string | null>) => {
      state.connectedAt = action.payload;
    },
    setDisconnectedAt: (state, action: PayloadAction<string | null>) => {
      state.disconnectedAt = action.payload;
    },
    incrementReconnectAttempts: (state) => {
      state.reconnectAttempts += 1;
    },
    resetReconnectAttempts: (state) => {
      state.reconnectAttempts = 0;
    },
    subscribeToGroup: (state, action: PayloadAction<string>) => {
      const groupId = action.payload;
      if (!state.subscribedGroupIds.includes(groupId)) {
        state.subscribedGroupIds.push(groupId);
      }
    },
    unsubscribeFromGroup: (state, action: PayloadAction<string>) => {
      state.subscribedGroupIds = state.subscribedGroupIds.filter((id) => id !== action.payload);
    },
    setWebSocketUrl: (state, action: PayloadAction<string | null>) => {
      state.url = action.payload;
    },
  },
});

export const {
  setWebSocketStatus,
  setWebSocketError,
  setConnectedAt,
  setDisconnectedAt,
  incrementReconnectAttempts,
  resetReconnectAttempts,
  subscribeToGroup,
  unsubscribeFromGroup,
  setWebSocketUrl,
} = websocketSlice.actions;

// Base selectors
const selectWebSocketState = (state: { websocket: WebSocketState }) => state.websocket;

// Optimized selectors using createSelector
export const selectWebSocketStatus = createSelector(
  [selectWebSocketState],
  (websocket) => websocket.status
);

export const selectWebSocketError = createSelector(
  [selectWebSocketState],
  (websocket) => websocket.lastError
);

export const selectIsWebSocketConnected = createSelector(
  [selectWebSocketStatus],
  (status) => status === 'connected'
);

export const selectSubscribedGroupIds = createSelector(
  [selectWebSocketState],
  (websocket) => websocket.subscribedGroupIds
);

export const selectReconnectAttempts = createSelector(
  [selectWebSocketState],
  (websocket) => websocket.reconnectAttempts
);

export const selectWebSocketConnectionInfo = createSelector(
  [selectWebSocketState],
  (websocket) => ({
    status: websocket.status,
    connectedAt: websocket.connectedAt,
    disconnectedAt: websocket.disconnectedAt,
    lastError: websocket.lastError,
    reconnectAttempts: websocket.reconnectAttempts,
    maxReconnectAttempts: websocket.maxReconnectAttempts,
    url: websocket.url,
  })
);

export default websocketSlice.reducer;
