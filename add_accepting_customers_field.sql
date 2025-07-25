-- Add acceptingCustomers field to Queue table if it doesn't exist
ALTER TABLE "Queue" 
ADD COLUMN IF NOT EXISTS "acceptingCustomers" BOOLEAN DEFAULT true;