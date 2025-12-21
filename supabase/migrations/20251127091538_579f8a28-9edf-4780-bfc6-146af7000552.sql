-- Add discipline and original_filename to plan_pages for better plan management
ALTER TABLE plan_pages 
ADD COLUMN discipline TEXT DEFAULT 'unknown',
ADD COLUMN original_filename TEXT;