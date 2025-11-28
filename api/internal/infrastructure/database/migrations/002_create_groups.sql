CREATE TABLE IF NOT EXISTS groups (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('village', 'hamlet', 'residential_group', 'street_block', 'ward', 'commune', 'apartment', 'residential_area', 'other')),
    latitude DECIMAL(10, 6) NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
    longitude DECIMAL(10, 6) NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
    region_code VARCHAR(10),
    creator_device_id VARCHAR(32) NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(creator_device_id) -- Each device can create only one group
);

-- Create index on location for geographic queries (using B-tree for simple distance calculations)
CREATE INDEX IF NOT EXISTS idx_groups_location ON groups(latitude, longitude);

-- Create index on region_code for regional scaling
CREATE INDEX IF NOT EXISTS idx_groups_region_code ON groups(region_code) WHERE region_code IS NOT NULL;

-- Create index on creator_device_id
CREATE INDEX IF NOT EXISTS idx_groups_creator_device_id ON groups(creator_device_id);

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_groups_updated_at
    BEFORE UPDATE ON groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable PostGIS extension for geographic queries (if available)
-- CREATE EXTENSION IF NOT EXISTS postgis;

