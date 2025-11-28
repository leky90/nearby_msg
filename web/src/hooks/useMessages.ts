/**
 * useMessages Hook
 * Reactive hook for querying messages from RxDB
 * Uses TanStack Query for initial load and caching, with reactive subscriptions for real-time updates
 */

import { useEffect, useState, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Message } from '../domain/message';
import { watchGroupMessages, getDatabase } from '../services/db';

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
 * Query function for fetching messages from RxDB (for TanStack Query)
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
 * Uses TanStack Query for initial load and caching, with reactive subscriptions for real-time updates
 * Optimized to prevent unnecessary re-renders when messages haven't actually changed
 */
export function useMessages({
  groupId,
  limit = 1000,
  reactive = true,
}: UseMessagesOptions): UseMessagesResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const updateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use TanStack Query for initial load and caching
  const {
    data: initialMessages,
    isLoading: queryLoading,
    error: queryError,
    refetch: refresh,
  } = useQuery({
    queryKey: ['messages', groupId, limit],
    queryFn: () => fetchMessages(groupId, limit),
    enabled: !!groupId,
    staleTime: 30 * 1000, // 30 seconds (messages change frequently)
    retry: 2,
  });

  // Update messages when query data changes (only if different)
  useEffect(() => {
    if (initialMessages && !areMessagesEqual(messagesRef.current, initialMessages)) {
      messagesRef.current = initialMessages;
      setMessages(initialMessages);
    }
  }, [initialMessages]);

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
        console.error('Failed to setup reactive query:', err);
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

  // Memoize messages to prevent unnecessary re-renders
  // The messages state is already optimized with deep comparison, but this adds an extra layer
  const memoizedMessages = useMemo(() => messages, [messages]);

  return {
    messages: memoizedMessages,
    isLoading: queryLoading,
    error: queryError instanceof Error ? queryError : queryError ? new Error(String(queryError)) : null,
    refresh: async () => {
      await refresh();
    },
  };
}

