-- Migration: Update group types to support smaller geographic areas (2km radius)
-- Remove large area types (district, county, city, province, neighborhood)
-- Add smaller area types (village, hamlet, residential_group, street_block, commune, residential_area)

-- Drop the old CHECK constraint
ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_type_check;

-- Add new CHECK constraint with updated group types
ALTER TABLE groups ADD CONSTRAINT groups_type_check 
    CHECK (type IN ('village', 'hamlet', 'residential_group', 'street_block', 'ward', 'commune', 'apartment', 'residential_area', 'other'));

-- Note: Existing groups with old types will need to be migrated manually
-- If you have existing data, you may want to:
-- UPDATE groups SET type = 'residential_area' WHERE type = 'neighborhood';
-- UPDATE groups SET type = 'ward' WHERE type = 'district';

