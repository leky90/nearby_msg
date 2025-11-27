/**
 * useMessages Hook
 * Reactive hook for querying messages from RxDB
 */

import { useEffect, useState } from 'react';
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
 * useMessages hook
 * Provides reactive message queries from RxDB
 */
export function useMessages({
  groupId,
  limit = 1000,
  reactive = true,
}: UseMessagesOptions): UseMessagesResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadMessages = async () => {
    try {
      setIsLoading(true);
      setError(null);
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
      const messageArray = results.map((doc) => doc.toJSON() as Message);
      setMessages(messageArray);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load messages'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!groupId) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    // Initial load
    void loadMessages();

    if (!reactive) {
      return;
    }

    // Set up reactive subscription using watchGroupMessages
    let unsubscribe: (() => void) | null = null;

    const setupReactive = async () => {
      try {
        unsubscribe = await watchGroupMessages(groupId, (messageArray) => {
          // Apply limit if specified
          const limitedMessages = limit ? messageArray.slice(-limit) : messageArray;
          setMessages(limitedMessages);
          setIsLoading(false);
        });
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to setup reactive query'));
        setIsLoading(false);
      }
    };

    void setupReactive();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, limit, reactive]);

  return {
    messages,
    isLoading,
    error,
    refresh: loadMessages,
  };
}

