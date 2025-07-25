-- Remove priority-related columns from MerchantSettings table
ALTER TABLE "MerchantSettings" 
DROP COLUMN IF EXISTS "priorityEnabled",
DROP COLUMN IF EXISTS "prioritySlots",
DROP COLUMN IF EXISTS "prioritySkipRegular",
DROP COLUMN IF EXISTS "priorityNotifyFirst",
DROP COLUMN IF EXISTS "priorityLongerGrace";

-- Remove priority column from QueueEntry table
ALTER TABLE "QueueEntry" 
DROP COLUMN IF EXISTS "priority";

-- Note: The Priority enum type will be automatically removed when no columns reference it