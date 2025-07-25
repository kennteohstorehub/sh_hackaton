-- Add default value for id column in Session table
-- This will allow connect-pg-simple to work without providing an id

-- First, update any existing rows with NULL id (there shouldn't be any, but just in case)
UPDATE "Session" 
SET "id" = gen_random_uuid() 
WHERE "id" IS NULL;

-- Then alter the column to have a default value
ALTER TABLE "Session" 
ALTER COLUMN "id" SET DEFAULT gen_random_uuid();