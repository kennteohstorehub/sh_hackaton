-- Remove the id column and make sid the primary key
-- This matches what connect-pg-simple expects

-- First drop the primary key constraint on id
ALTER TABLE "Session" DROP CONSTRAINT "Session_pkey";

-- Drop the id column
ALTER TABLE "Session" DROP COLUMN "id";

-- Make sid the primary key
ALTER TABLE "Session" ADD PRIMARY KEY ("sid");

-- Remove the unique constraint on sid since it's now the primary key
ALTER TABLE "Session" DROP CONSTRAINT IF EXISTS "Session_sid_key";