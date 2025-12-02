-- Migration: Update groups table to set creator_device_id to NULL when device is deleted
-- This allows groups to persist even after the creator device is deleted

-- Step 1: Drop the unique constraint on creator_device_id
-- (Multiple groups can have NULL creator_device_id after device deletion)
ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_creator_device_id_key;

-- Step 2: Drop the existing foreign key constraint with CASCADE
ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_creator_device_id_fkey;

-- Step 3: Change creator_device_id to allow NULL
ALTER TABLE groups ALTER COLUMN creator_device_id DROP NOT NULL;

-- Step 4: Recreate foreign key constraint with SET NULL on delete
-- This ensures groups are preserved when creator device is deleted
ALTER TABLE groups 
    ADD CONSTRAINT groups_creator_device_id_fkey 
    FOREIGN KEY (creator_device_id) 
    REFERENCES devices(id) 
    ON DELETE SET NULL;

-- Note: The UNIQUE constraint on creator_device_id is intentionally removed
-- because:
-- 1. Multiple groups can have NULL creator_device_id (orphaned groups)
-- 2. A device can only create one group while it exists (enforced by application logic)
-- 3. After device deletion, groups become orphaned and can coexist
