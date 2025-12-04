/**
 * Messages Redux Slice
 * Manages message state for all groups
 * Optimized for performance with incremental updates
 */

import { createSlice, createSelector } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Message } from '@/shared/domain/message';
import type { RootState } from '@/store';

interface GroupMessagesState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: string | null;
}

interface MessagesState {
  byGroupId: Record<string, GroupMessagesState>;
  pendingMessages: Message[];
  receivedMessageIds: string[];
  // ... existing pinned messages state
  pinnedMessagesByGroupId: Record<
    string,
    {
      pinnedMessages: Array<{ message: Message; pinned_at: string; pinned_by_device_id: string }>;
      isLoading: boolean;
      error: string | null;
    }
  >;
}

const initialState: MessagesState = {
  byGroupId: {},
  pendingMessages: [],
  receivedMessageIds: [],
  pinnedMessagesByGroupId: {},
};

/**
 * Binary search to find insertion index for sorted array
 * Returns index where message should be inserted to maintain sort order
 */
function findInsertionIndex(
  messages: Message[],
  newMessage: Message
): number {
  const newTime = new Date(newMessage.created_at).getTime();
  const newSeq = newMessage.device_sequence ?? 0;

  let left = 0;
  let right = messages.length;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    const midTime = new Date(messages[mid].created_at).getTime();
    const midSeq = messages[mid].device_sequence ?? 0;

    if (midTime < newTime) {
      left = mid + 1;
    } else if (midTime > newTime) {
      right = mid;
    } else {
      // Same timestamp, compare device_sequence
      if (midSeq < newSeq) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
  }

  return left;
}

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

      // Replace messages directly to ensure deletions (like optimistic updates) are reflected
      // The incoming messages from RxDB are already sorted by created_at
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
        // Use binary search to insert at correct position (O(log n))
        const insertIndex = findInsertionIndex(
          state.byGroupId[groupId].messages,
          message
        );
        state.byGroupId[groupId].messages.splice(insertIndex, 0, message);
      }
    },
    updateMessage: (
      state,
      action: PayloadAction<{ groupId: string; messageId: string; updates: Partial<Message> }>
    ) => {
      const { groupId, messageId, updates } = action.payload;
      const groupState = state.byGroupId[groupId];
      if (groupState) {
        const messageIndex = groupState.messages.findIndex(
          (m) => m.id === messageId
        );
        if (messageIndex >= 0) {
          groupState.messages[messageIndex] = {
            ...groupState.messages[messageIndex],
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
          isLoading: false,
          error: null,
          lastFetchedAt: null,
        };
      }
      state.byGroupId[groupId].isLoading = isLoading;
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
          error: null,
          lastFetchedAt: null,
        };
      }
      state.byGroupId[groupId].error = error;
    },
    markMessageReceived: (
      state,
      action: PayloadAction<{ messageId: string }>
    ) => {
      const { messageId } = action.payload;
      if (!state.receivedMessageIds.includes(messageId)) {
        state.receivedMessageIds.push(messageId);
      }
    },
    queuePendingMessage: (
      state,
      action: PayloadAction<Message>
    ) => {
      const message = action.payload;
      // Avoid duplicates
      if (!state.pendingMessages.find((m) => m.id === message.id)) {
        state.pendingMessages.push(message);
      }
    },
    removePendingMessage: (
      state,
      action: PayloadAction<string>
    ) => {
      const messageId = action.payload;
      state.pendingMessages = state.pendingMessages.filter(
        (m) => m.id !== messageId
      );
    },
    clearMessages: (
      state,
      action: PayloadAction<{ groupId: string }>
    ) => {
      const { groupId } = action.payload;
      delete state.byGroupId[groupId];
    },
    // Pinned messages reducers
    setPinnedMessages: (
      state,
      action: PayloadAction<{
        groupId: string;
        pinnedMessages: Array<{ message: Message; pinned_at: string; pinned_by_device_id: string }>;
      }>
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
          isLoading: false,
          error: null,
        };
      }
      state.pinnedMessagesByGroupId[groupId].isLoading = isLoading;
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
  return messages.filter((m) => m.device_id !== deviceId).length;
};

/**
 * Selector for pinned messages by group ID
 */
export const selectPinnedMessagesByGroupId = createSelector(
  [selectMessagesState, (_state: { messages: MessagesState }, groupId: string) => groupId],
  (messages, groupId) => messages.pinnedMessagesByGroupId[groupId]?.pinnedMessages || []
);

/**
 * Selector for pinned messages loading state by group ID
 */
export const selectPinnedMessagesLoading = createSelector(
  [selectMessagesState, (_state: { messages: MessagesState }, groupId: string) => groupId],
  (messages, groupId) => messages.pinnedMessagesByGroupId[groupId]?.isLoading || false
);

/**
 * Selector for pinned messages error by group ID
 */
export const selectPinnedMessagesError = createSelector(
  [selectMessagesState, (_state: { messages: MessagesState }, groupId: string) => groupId],
  (messages, groupId) => messages.pinnedMessagesByGroupId[groupId]?.error || null
);

export default messagesSlice.reducer;
