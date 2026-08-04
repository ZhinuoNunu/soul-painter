ALTER TABLE works ADD COLUMN IF NOT EXISTS original_object_url TEXT;

UPDATE works
SET original_object_url = share_image_url
WHERE original_object_url IS NULL;
