/**
 * useMessages Hook
 * Provides messages from Redux state
 * Uses Redux Saga for data loading and subscriptions
 */

import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { Message } from "@/shared/domain/message";
import {
  selectMessagesByGroupId,
  selectMessagesLoading,
  selectMessagesError,
} from "@/features/messages/store/slice";
import { syncMessagesAction, startMessageSubscriptionAction, stopMessageSubscriptionAction } from "@/features/messages/store/saga";
import type { RootState } from "@/store";

export interface UseMessagesOptions {
  /** Group ID to filter messages */
  groupId: string;
  /** Maximum number of messages to return */
  limit?: number;
  /** Whether to enable reactive updates */
  reactive?: boolean;
}

export interface UseMessagesResult {
  /** Messages array */
  messages: Message[];
  /** Whether messages are loading */
  isLoading: boolean;
  /** Error if any */
  error: Error | null;
  /** Refresh messages manually */
  refresh: () => Promise<void>;
}

/**
 * useMessages hook
 * Provides messages from Redux state
 * All side effects (subscriptions, data loading) are managed by sagas
 */
export function useMessages({
  groupId,
  limit = 1000,
  reactive = true,
}: UseMessagesOptions): UseMessagesResult {
  const dispatch = useDispatch();

  // Read messages from Redux state only
  const messages = useSelector((state: RootState) =>
    selectMessagesByGroupId(state, groupId)
  );
  const isLoading = useSelector((state: RootState) =>
    selectMessagesLoading(state, groupId)
  );
  const reduxError = useSelector((state: RootState) =>
    selectMessagesError(state, groupId)
  );

  // Apply limit to messages (client-side limit for display)
  const limitedMessages = limit ? messages.slice(-limit) : messages;

  // Sync messages on mount and when groupId changes
  useEffect(() => {
    if (groupId) {
      dispatch(syncMessagesAction(groupId));
    }
  }, [groupId, dispatch]);

  // Start/stop reactive subscription based on reactive flag
  useEffect(() => {
    if (!groupId || !reactive) {
      return;
    }

    // Start subscription
    dispatch(startMessageSubscriptionAction(groupId, limit));

    // Cleanup: stop subscription on unmount or when groupId/reactive changes
    return () => {
      dispatch(stopMessageSubscriptionAction(groupId));
    };
  }, [groupId, limit, reactive, dispatch]);

  // Determine error state
  const error: Error | null = reduxError ? new Error(reduxError) : null;

  return {
    messages: limitedMessages,
    isLoading,
    error,
    refresh: async () => {
      dispatch(syncMessagesAction(groupId));
    },
  };
}
