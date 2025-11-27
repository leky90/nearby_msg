CREATE TABLE IF NOT EXISTS favorite_groups (
    id VARCHAR(32) PRIMARY KEY,
    device_id VARCHAR(32) NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    group_id VARCHAR(32) NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(device_id, group_id) -- Device cannot favorite same group twice
);

-- Create index on device_id for user's favorites list
CREATE INDEX IF NOT EXISTS idx_favorite_groups_device_id ON favorite_groups(device_id, created_at DESC);

-- Create index on group_id for group popularity queries
CREATE INDEX IF NOT EXISTS idx_favorite_groups_group_id ON favorite_groups(group_id);

