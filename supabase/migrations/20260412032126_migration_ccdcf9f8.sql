-- Ensure the metadata column is ready for raw JSON insertion
    ALTER TABLE games ALTER COLUMN processing_metadata SET DEFAULT '{}'::jsonb;
    UPDATE games SET processing_metadata = '{}'::jsonb WHERE processing_metadata IS NULL;