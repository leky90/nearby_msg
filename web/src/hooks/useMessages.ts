/**
 * useMessages Hook
 * Reactive hook for querying messages from RxDB
 * Uses Redux Saga for initial load, with reactive subscriptions for real-time updates
 */

import { useEffect, useState, useRef, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { Message } from '../domain/message';
import { watchGroupMessages, getDatabase } from '../services/db';
import { log } from '../lib/logging/logger';
import {
    selectMessagesByGroupId,
    selectMessagesLoading,
    selectMessagesError,
} from '../store/slices/messagesSlice';
import { syncMessagesAction } from '../store/sagas/messageSaga';
import type { RootState } from '../store';

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
 * Query function for fetching messages from RxDB
 */
async function fetchMessages(groupId: string, limit: number): Promise<Message[]> {
  const db = await getDatabase();
  const query = db.messages
    .find({
      selector: {
        group_id: groupId,
      },
      sort: [{ created_at: 'asc' }],
      limit,
    })
    .exec();

  const results = await query;
  return results.map((doc) => doc.toJSON() as Message);
}

/**
 * Compares two message arrays to determine if they're equal
 * Only checks meaningful fields to avoid unnecessary re-renders
 */
function areMessagesEqual(prev: Message[], next: Message[]): boolean {
  if (prev.length !== next.length) return false;
  
  // Quick reference check
  if (prev === next) return true;
  
  // Deep comparison of message IDs and key fields
  return prev.every((msg, idx) => {
    const nextMsg = next[idx];
    if (!nextMsg) return false;
    
    return (
      msg.id === nextMsg.id &&
      msg.content === nextMsg.content &&
      msg.sync_status === nextMsg.sync_status &&
      msg.created_at === nextMsg.created_at &&
      msg.device_id === nextMsg.device_id
    );
  });
}

/**
 * useMessages hook
 * Provides reactive message queries from RxDB
 * Uses Redux Saga for initial load, with reactive subscriptions for real-time updates
 * Optimized to prevent unnecessary re-renders when messages haven't actually changed
 */
export function useMessages({
  groupId,
  limit = 1000,
  reactive = true,
}: UseMessagesOptions): UseMessagesResult {
  const dispatch = useDispatch();
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const updateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Redux selectors
  const reduxMessages = useSelector((state: RootState) =>
    selectMessagesByGroupId(state, groupId)
  );
  const reduxLoading = useSelector((state: RootState) =>
    selectMessagesLoading(state, groupId)
  );
  const reduxError = useSelector((state: RootState) =>
    selectMessagesError(state, groupId)
  );

  // Fetch initial messages using Redux Saga
  useEffect(() => {
    if (groupId) {
      dispatch(syncMessagesAction(groupId));
      // Also load from RxDB directly for immediate display
      fetchMessages(groupId, limit).then((initialMessages) => {
        if (initialMessages.length > 0) {
          dispatch({ type: 'messages/setMessages', payload: { groupId, messages: initialMessages } });
        }
      }).catch((err) => {
        log.error('Failed to fetch initial messages', err, { groupId });
      });
    }
  }, [groupId, limit, dispatch]);

  // Set up reactive subscription for real-time updates
  useEffect(() => {
    if (!groupId || !reactive) {
      return;
    }

    let unsubscribe: (() => void) | null = null;

    const setupReactive = async () => {
      try {
        unsubscribe = await watchGroupMessages(groupId, (messageArray) => {
          // Apply limit if specified
          const limitedMessages = limit ? messageArray.slice(-limit) : messageArray;
          
          // Debounce updates to prevent rapid re-renders during sync
          // This helps prevent UI flash when multiple messages update at once
          if (updateTimerRef.current) {
            clearTimeout(updateTimerRef.current);
          }
          
          updateTimerRef.current = setTimeout(() => {
            // Only update if messages actually changed
            if (!areMessagesEqual(messagesRef.current, limitedMessages)) {
              messagesRef.current = limitedMessages;
              setMessages(limitedMessages);
            }
            updateTimerRef.current = null;
          }, 50); // 50ms debounce - short enough to feel instant, long enough to batch updates
        });
      } catch (err) {
        log.error('Failed to setup reactive query', err, { groupId });
      }
    };

    void setupReactive();

    return () => {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [groupId, limit, reactive]);

  // Use Redux messages if available, otherwise use local state
  const finalMessages = reduxMessages.length > 0 ? reduxMessages : messages;

  // Memoize messages to prevent unnecessary re-renders
  const memoizedMessages = useMemo(() => finalMessages, [finalMessages]);

  // Determine loading state (Redux)
  const isLoading = reduxLoading;
  
  // Determine error state (Redux)
  const error: Error | null = reduxError ? new Error(reduxError) : null;

  return {
    messages: memoizedMessages,
    isLoading,
    error,
    refresh: async () => {
      dispatch(syncMessagesAction(groupId));
    },
  };
}

