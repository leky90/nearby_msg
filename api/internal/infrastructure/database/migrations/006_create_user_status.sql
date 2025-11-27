CREATE TABLE IF NOT EXISTS user_status (
    id VARCHAR(32) PRIMARY KEY,
    device_id VARCHAR(32) NOT NULL UNIQUE REFERENCES devices(id) ON DELETE CASCADE,
    status_type VARCHAR(20) NOT NULL CHECK (status_type IN ('safe', 'need_help', 'cannot_contact')),
    description VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index on device_id (already unique, but explicit index for queries)
CREATE INDEX IF NOT EXISTS idx_user_status_device_id ON user_status(device_id);

-- Create index on (status_type, updated_at) for status summaries
CREATE INDEX IF NOT EXISTS idx_user_status_type_updated ON user_status(status_type, updated_at DESC);

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_user_status_updated_at
    BEFORE UPDATE ON user_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

