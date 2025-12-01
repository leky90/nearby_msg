import { createSlice, type PayloadAction, createSelector } from '@reduxjs/toolkit';
import type { Message } from "@/shared/domain/message";
import type { PinnedMessage } from "@/shared/domain/pinned_message";
import type { RootState } from "@/store";

interface GroupMessagesState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: string | null;
}

interface MessagesState {
  // Messages organized by group ID
  byGroupId: Record<string, GroupMessagesState>;
  
  // Message IDs received via WebSocket (for deduplication)
  receivedMessageIds: string[]; // Array instead of Set for Redux serialization
  
  // Pending messages (queued during WebSocket disconnection)
  pendingMessages: Array<{
    message: Message;
    timestamp: string;
    retryCount: number;
  }>;
  
  // Pinned messages organized by group ID
  pinnedMessagesByGroupId: Record<string, {
    pinnedMessages: PinnedMessage[];
    isLoading: boolean;
    error: string | null;
  }>;
}

const initialState: MessagesState = {
  byGroupId: {},
  receivedMessageIds: [],
  pendingMessages: [],
  pinnedMessagesByGroupId: {},
};

const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    setMessages: (
      state,
      action: PayloadAction<{ groupId: string; messages: Message[] }>
    ) => {
      const { groupId, messages } = action.payload;
      if (!state.byGroupId[groupId]) {
        state.byGroupId[groupId] = {
          messages: [],
          isLoading: false,
          error: null,
          lastFetchedAt: null,
        };
      }
      state.byGroupId[groupId].messages = messages;
      state.byGroupId[groupId].lastFetchedAt = new Date().toISOString();
    },
    addMessage: (
      state,
      action: PayloadAction<{ groupId: string; message: Message }>
    ) => {
      const { groupId, message } = action.payload;
      if (!state.byGroupId[groupId]) {
        state.byGroupId[groupId] = {
          messages: [],
          isLoading: false,
          error: null,
          lastFetchedAt: null,
        };
      }
      // Avoid duplicates
      if (!state.byGroupId[groupId].messages.find((m) => m.id === message.id)) {
        state.byGroupId[groupId].messages.push(message);
        // Sort by created_at (message ordering)
        // Also sort by device_sequence if available for same timestamp
        state.byGroupId[groupId].messages.sort((a, b) => {
          const timeA = new Date(a.created_at).getTime();
          const timeB = new Date(b.created_at).getTime();
          if (timeA !== timeB) {
            return timeA - timeB;
          }
          // If timestamps are equal, use device_sequence if available
          const seqA = a.device_sequence ?? 0;
          const seqB = b.device_sequence ?? 0;
          return seqA - seqB;
        });
      }
    },
    updateMessage: (
      state,
      action: PayloadAction<{ groupId: string; messageId: string; updates: Partial<Message> }>
    ) => {
      const { groupId, messageId, updates } = action.payload;
      const groupMessages = state.byGroupId[groupId];
      if (groupMessages) {
        const messageIndex = groupMessages.messages.findIndex((m) => m.id === messageId);
        if (messageIndex !== -1) {
          groupMessages.messages[messageIndex] = {
            ...groupMessages.messages[messageIndex],
            ...updates,
          };
        }
      }
    },
    setMessagesLoading: (
      state,
      action: PayloadAction<{ groupId: string; isLoading: boolean }>
    ) => {
      const { groupId, isLoading } = action.payload;
      if (!state.byGroupId[groupId]) {
        state.byGroupId[groupId] = {
          messages: [],
          isLoading,
          error: null,
          lastFetchedAt: null,
        };
      } else {
        state.byGroupId[groupId].isLoading = isLoading;
      }
    },
    setMessagesError: (
      state,
      action: PayloadAction<{ groupId: string; error: string | null }>
    ) => {
      const { groupId, error } = action.payload;
      if (!state.byGroupId[groupId]) {
        state.byGroupId[groupId] = {
          messages: [],
          isLoading: false,
          error,
          lastFetchedAt: null,
        };
      } else {
        state.byGroupId[groupId].error = error;
      }
    },
    markMessageReceived: (state, action: PayloadAction<string>) => {
      const messageId = action.payload;
      if (!state.receivedMessageIds.includes(messageId)) {
        state.receivedMessageIds.push(messageId);
        // Keep only last 1000 message IDs to prevent memory issues
        if (state.receivedMessageIds.length > 1000) {
          state.receivedMessageIds = state.receivedMessageIds.slice(-1000);
        }
      }
    },
    queuePendingMessage: (state, action: PayloadAction<Message>) => {
      state.pendingMessages.push({
        message: action.payload,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });
    },
    removePendingMessage: (state, action: PayloadAction<string>) => {
      state.pendingMessages = state.pendingMessages.filter(
        (pm) => pm.message.id !== action.payload
      );
    },
    clearMessages: (state, action: PayloadAction<string>) => {
      delete state.byGroupId[action.payload];
    },
    setPinnedMessages: (
      state,
      action: PayloadAction<{ groupId: string; pinnedMessages: PinnedMessage[] }>
    ) => {
      const { groupId, pinnedMessages } = action.payload;
      if (!state.pinnedMessagesByGroupId[groupId]) {
        state.pinnedMessagesByGroupId[groupId] = {
          pinnedMessages: [],
          isLoading: false,
          error: null,
        };
      }
      state.pinnedMessagesByGroupId[groupId].pinnedMessages = pinnedMessages;
    },
    setPinnedMessagesLoading: (
      state,
      action: PayloadAction<{ groupId: string; isLoading: boolean }>
    ) => {
      const { groupId, isLoading } = action.payload;
      if (!state.pinnedMessagesByGroupId[groupId]) {
        state.pinnedMessagesByGroupId[groupId] = {
          pinnedMessages: [],
          isLoading,
          error: null,
        };
      } else {
        state.pinnedMessagesByGroupId[groupId].isLoading = isLoading;
      }
    },
    setPinnedMessagesError: (
      state,
      action: PayloadAction<{ groupId: string; error: string | null }>
    ) => {
      const { groupId, error } = action.payload;
      if (!state.pinnedMessagesByGroupId[groupId]) {
        state.pinnedMessagesByGroupId[groupId] = {
          pinnedMessages: [],
          isLoading: false,
          error,
        };
      } else {
        state.pinnedMessagesByGroupId[groupId].error = error;
      }
    },
  },
});

export const {
  setMessages,
  addMessage,
  updateMessage,
  setMessagesLoading,
  setMessagesError,
  markMessageReceived,
  queuePendingMessage,
  removePendingMessage,
  clearMessages,
  setPinnedMessages,
  setPinnedMessagesLoading,
  setPinnedMessagesError,
} = messagesSlice.actions;

// Base selector
const selectMessagesState = (state: { messages: MessagesState }) => state.messages;

// Optimized selectors using createSelector
export const selectPendingMessages = createSelector(
  [selectMessagesState],
  (messages) => messages.pendingMessages
);

export const selectReceivedMessageIds = createSelector(
  [selectMessagesState],
  (messages) => messages.receivedMessageIds
);

// Parametrized selectors (using factory pattern for createSelector)
export const selectMessagesByGroupId = createSelector(
  [selectMessagesState, (_state: { messages: MessagesState }, groupId: string) => groupId],
  (messages, groupId) => messages.byGroupId[groupId]?.messages || []
);

export const selectMessagesLoading = createSelector(
  [selectMessagesState, (_state: { messages: MessagesState }, groupId: string) => groupId],
  (messages, groupId) => messages.byGroupId[groupId]?.isLoading || false
);

export const selectMessagesError = createSelector(
  [selectMessagesState, (_state: { messages: MessagesState }, groupId: string) => groupId],
  (messages, groupId) => messages.byGroupId[groupId]?.error || null
);

export const hasReceivedMessage = createSelector(
  [selectReceivedMessageIds, (_state: { messages: MessagesState }, messageId: string) => messageId],
  (receivedIds, messageId) => receivedIds.includes(messageId)
);

export const selectGroupMessagesState = createSelector(
  [selectMessagesState, (_state: { messages: MessagesState }, groupId: string) => groupId],
  (messages, groupId) => messages.byGroupId[groupId] || {
    messages: [],
    isLoading: false,
    error: null,
    lastFetchedAt: null,
  }
);

/**
 * Selector for latest message in a group
 * Returns the most recent message based on created_at timestamp
 */
export const selectLatestMessageByGroupId = (
  state: RootState,
  groupId: string
): Message | null => {
  const messages = selectMessagesByGroupId(state, groupId);
  if (messages.length === 0) return null;
  // Messages are already sorted by created_at in the slice (ascending)
  // Last message is the most recent
  return messages[messages.length - 1];
};

/**
 * Selector factory for unread message count in a group
 * Counts messages not sent by current device
 * Note: This is a simplified unread count (all messages not from current device)
 * For more accurate unread tracking, we'd need to track last read timestamps
 */
export const selectUnreadCountByGroupId = (
  state: RootState,
  groupId: string
): number => {
  const messages = selectMessagesByGroupId(state, groupId);
  const deviceId = state.device?.device?.id || null;
  if (!deviceId) return 0;
  // Count messages not sent by current device
  return messages.filter((msg) => msg.device_id !== deviceId).length;
};

/**
 * Selector for pinned messages by group ID
 */
export const selectPinnedMessagesByGroupId = createSelector(
  [selectMessagesState, (_state: { messages: MessagesState }, groupId: string) => groupId],
  (messages, groupId) => messages.pinnedMessagesByGroupId[groupId]?.pinnedMessages || []
);

/**
 * Selector for pinned messages loading state
 */
export const selectPinnedMessagesLoading = createSelector(
  [selectMessagesState, (_state: { messages: MessagesState }, groupId: string) => groupId],
  (messages, groupId) => messages.pinnedMessagesByGroupId[groupId]?.isLoading || false
);

/**
 * Selector for pinned messages error state
 */
export const selectPinnedMessagesError = createSelector(
  [selectMessagesState, (_state: { messages: MessagesState }, groupId: string) => groupId],
  (messages, groupId) => messages.pinnedMessagesByGroupId[groupId]?.error || null
);

export default messagesSlice.reducer;
