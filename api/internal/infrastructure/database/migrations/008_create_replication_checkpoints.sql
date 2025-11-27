-- Create replication checkpoints table
CREATE TABLE IF NOT EXISTS replication_checkpoints (
    device_id VARCHAR(32) NOT NULL,
    collection VARCHAR(50) NOT NULL,
    checkpoint TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (device_id, collection)
);

-- Index for ordering by checkpoint
CREATE INDEX IF NOT EXISTS idx_replication_checkpoint_time ON replication_checkpoints(checkpoint DESC);

