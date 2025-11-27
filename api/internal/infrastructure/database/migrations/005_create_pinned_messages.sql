CREATE TABLE IF NOT EXISTS pinned_messages (
    id VARCHAR(32) PRIMARY KEY,
    message_id VARCHAR(32) NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    group_id VARCHAR(32) NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    device_id VARCHAR(32) NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    pinned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    tag VARCHAR(50)
);

-- Create index on group_id for group's pinned messages
CREATE INDEX IF NOT EXISTS idx_pinned_messages_group_id ON pinned_messages(group_id, pinned_at DESC);

-- Create index on message_id for message pin lookup
CREATE INDEX IF NOT EXISTS idx_pinned_messages_message_id ON pinned_messages(message_id);

