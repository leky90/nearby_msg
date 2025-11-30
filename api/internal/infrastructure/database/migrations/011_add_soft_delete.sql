-- Migration: Add soft delete support for deletion sync
-- Adds deleted_at column to all tables that need deletion synchronization
-- Enables tracking of deleted entities for client synchronization

-- Add deleted_at column to groups table
ALTER TABLE groups ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;

-- Add deleted_at column to favorite_groups table
ALTER TABLE favorite_groups ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;

-- Add deleted_at column to messages table
ALTER TABLE messages ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;

-- Add deleted_at column to user_status table
ALTER TABLE user_status ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for efficient deletion queries
-- These indexes only include rows where deleted_at IS NOT NULL (partial indexes)
CREATE INDEX IF NOT EXISTS idx_groups_deleted_at ON groups(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_favorite_groups_deleted_at ON favorite_groups(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_deleted_at ON messages(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_status_deleted_at ON user_status(deleted_at) WHERE deleted_at IS NOT NULL;
