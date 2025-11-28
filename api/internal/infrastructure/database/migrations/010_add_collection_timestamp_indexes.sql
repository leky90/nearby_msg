-- Add timestamp indexes for efficient replication queries
-- These indexes support checkpoint-based queries: WHERE timestamp > checkpoint ORDER BY timestamp ASC

-- Index for groups replication queries (using updated_at)
CREATE INDEX IF NOT EXISTS idx_groups_updated_at ON groups(updated_at DESC);

-- Index for favorite_groups replication queries (using created_at)
CREATE INDEX IF NOT EXISTS idx_favorite_groups_created_at ON favorite_groups(created_at DESC);

-- Index for pinned_messages replication queries (using pinned_at)
CREATE INDEX IF NOT EXISTS idx_pinned_messages_pinned_at ON pinned_messages(pinned_at DESC);

-- Index for user_status replication queries (using updated_at)
CREATE INDEX IF NOT EXISTS idx_user_status_updated_at ON user_status(updated_at DESC);
