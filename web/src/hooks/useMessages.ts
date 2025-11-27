/**
 * useMessages Hook
 * Reactive hook for querying messages from RxDB
 * Uses TanStack Query for initial load and caching, with reactive subscriptions for real-time updates
 */

import { useEffect, useState } from 'react';
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
 * useMessages hook
 * Provides reactive message queries from RxDB
 * Uses TanStack Query for initial load and caching, with reactive subscriptions for real-time updates
 */
export function useMessages({
  groupId,
  limit = 1000,
  reactive = true,
}: UseMessagesOptions): UseMessagesResult {
  const [messages, setMessages] = useState<Message[]>([]);

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

  // Update messages when query data changes
  useEffect(() => {
    if (initialMessages) {
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
          setMessages(limitedMessages);
        });
      } catch (err) {
        console.error('Failed to setup reactive query:', err);
      }
    };

    void setupReactive();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [groupId, limit, reactive]);

  return {
    messages,
    isLoading: queryLoading,
    error: queryError instanceof Error ? queryError : queryError ? new Error(String(queryError)) : null,
    refresh: async () => {
      await refresh();
    },
  };
}

