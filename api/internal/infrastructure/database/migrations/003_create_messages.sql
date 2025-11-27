CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(32) PRIMARY KEY,
    group_id VARCHAR(32) NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    device_id VARCHAR(32) NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    content VARCHAR(500) NOT NULL CHECK (LENGTH(content) >= 1 AND LENGTH(content) <= 500),
    message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('text', 'sos', 'status_update')),
    sos_type VARCHAR(20) CHECK (
        (message_type = 'sos' AND sos_type IN ('medical', 'flood', 'fire', 'missing_person')) OR
        (message_type != 'sos' AND sos_type IS NULL)
    ),
    tags TEXT[], -- Array of strings
    pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    device_sequence INTEGER,
    synced_at TIMESTAMP WITH TIME ZONE
);

-- Create index on (group_id, created_at) for message retrieval
CREATE INDEX IF NOT EXISTS idx_messages_group_created ON messages(group_id, created_at DESC);

-- Create index on (group_id, pinned, created_at) for pinned messages
CREATE INDEX IF NOT EXISTS idx_messages_group_pinned ON messages(group_id, pinned, created_at DESC) WHERE pinned = TRUE;

-- Create index on device_id for device message queries
CREATE INDEX IF NOT EXISTS idx_messages_device_id ON messages(device_id);

-- Create index on created_at for ordering
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

