-- Additional indexes for performance optimization

-- Index for geographic queries with radius filtering
-- This supports efficient nearby group discovery
CREATE INDEX IF NOT EXISTS idx_groups_geo_query ON groups(latitude, longitude, created_at DESC);

-- Composite index for message ordering with device tiebreaker
CREATE INDEX IF NOT EXISTS idx_messages_ordering ON messages(group_id, created_at DESC, device_id);

-- Index for replication pull queries (checkpoint-based)
CREATE INDEX IF NOT EXISTS idx_messages_sync_checkpoint ON messages(created_at DESC, id) WHERE synced_at IS NOT NULL;

-- Index for finding unsynced messages
CREATE INDEX IF NOT EXISTS idx_messages_pending_sync ON messages(device_id, created_at) WHERE synced_at IS NULL;

