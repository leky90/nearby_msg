/**
 * Message Sync Service
 * Handles push/pull replication cycles with the backend
 */

import { post } from './api';
import { getDatabase, getPendingMessageDocs } from './db';
import type { Message } from '../domain/message';

const CHECKPOINT_KEY = 'nearby_msg_messages_checkpoint';
const DEFAULT_SYNC_INTERVAL = 5000;
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 30000; // 30 seconds

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let isSyncRunning = false;
let retryDelay = INITIAL_RETRY_DELAY;

type PushPayload = {
  id: string;
  group_id: string;
  content: string;
  message_type: Message['message_type'];
  sos_type?: Message['sos_type'];
  tags?: string[];
  created_at: string;
  device_sequence?: number;
};

type PullResponse = {
  messages: Message[];
  checkpoint: string;
};

function getCheckpoint(): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  return localStorage.getItem(CHECKPOINT_KEY);
}

function setCheckpoint(value: string): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(CHECKPOINT_KEY, value);
}

/**
 * Retries a function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      // Reset retry state on success
      retryDelay = INITIAL_RETRY_DELAY;
      return result;
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        // Exponential backoff with jitter
        const delay = Math.min(
          retryDelay * Math.pow(2, attempt) + Math.random() * 1000,
          MAX_RETRY_DELAY
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Retry failed');
}

async function pushPendingMessages(): Promise<void> {
  const pendingDocs = await getPendingMessageDocs();
  if (!pendingDocs.length) {
    return;
  }

  const payload: PushPayload[] = pendingDocs.map((doc) => {
    const data = doc.toJSON() as Message;
    return {
      id: data.id,
      group_id: data.group_id,
      content: data.content,
      message_type: data.message_type,
      sos_type: data.sos_type,
      tags: data.tags,
      created_at: data.created_at,
      device_sequence: data.device_sequence ?? undefined,
    };
  });

  try {
    await retryWithBackoff(() => post('/replicate/push', { messages: payload }));

    const syncedAt = new Date().toISOString();
    await Promise.all(
      pendingDocs.map((doc) =>
        doc.patch({
          sync_status: 'synced',
          synced_at: syncedAt,
        })
      )
    );
  } catch (error) {
    // Mark messages as failed after all retries exhausted
    const failedAt = new Date().toISOString();
    await Promise.all(
      pendingDocs.map((doc) =>
        doc.patch({
          sync_status: 'failed',
          synced_at: failedAt,
        })
      )
    );
    throw error;
  }
}

async function pullMessages(): Promise<void> {
  const checkpoint = getCheckpoint();
  const body: Record<string, unknown> = {};
  if (checkpoint) {
    body.since = checkpoint;
  }

  const response = await retryWithBackoff(() => post<PullResponse>('/replicate/pull', body));
  if (!response || !response.messages) {
    return;
  }

  const db = await getDatabase();

  await Promise.all(
    response.messages.map((msg) =>
      db.messages.upsert({
        ...msg,
        sync_status: 'synced',
        synced_at: msg.synced_at ?? new Date().toISOString(),
      })
    )
  );

  if (response.checkpoint) {
    setCheckpoint(response.checkpoint);
  }
}

async function syncCycle(): Promise<void> {
  if (isSyncRunning) {
    return;
  }
  isSyncRunning = true;
  try {
    await pushPendingMessages();
    await pullMessages();
  } catch (error) {
    console.warn('Message sync failed', error);
  } finally {
    isSyncRunning = false;
  }
}

/**
 * Starts the recurring sync loop.
 * @param intervalMs Sync interval in milliseconds
 */
export function startMessageSync(intervalMs: number = DEFAULT_SYNC_INTERVAL): void {
  if (syncTimer) {
    return;
  }

  const run = async () => {
    await syncCycle();
    syncTimer = setTimeout(run, intervalMs);
  };

  void run();
}

/**
 * Stops the recurring sync loop.
 */
export function stopMessageSync(): void {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
}

/**
 * Forces an immediate sync attempt.
 */
export async function triggerImmediateSync(): Promise<void> {
  await syncCycle();
}

