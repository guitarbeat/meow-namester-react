-- Add new columns to name_options table
ALTER TABLE name_options 
ADD COLUMN created_by TEXT,
ADD COLUMN votes_count INTEGER DEFAULT 0,
ADD COLUMN average_rating INTEGER DEFAULT 1500;

-- Update existing records with default values
UPDATE name_options
SET 
    created_by = 'system',
    votes_count = 0,
    average_rating = 1500
WHERE created_by IS NULL; 