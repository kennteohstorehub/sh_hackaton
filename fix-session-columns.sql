-- Migration to fix session table columns
-- This renames columns to match connect-pg-simple expectations

ALTER TABLE "Session" 
RENAME COLUMN "data" TO "sess";

ALTER TABLE "Session" 
RENAME COLUMN "expiresAt" TO "expire";
