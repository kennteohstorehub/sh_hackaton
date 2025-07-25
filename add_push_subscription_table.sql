-- Create PushSubscription table for PWA push notifications
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "queueEntryId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "expirationTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- Create unique index on endpoint
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- Create index on queueEntryId for faster lookups
CREATE INDEX IF NOT EXISTS "PushSubscription_queueEntryId_idx" ON "PushSubscription"("queueEntryId");

-- Add foreign key constraint (only if QueueEntry table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'QueueEntry') THEN
        ALTER TABLE "PushSubscription" 
        ADD CONSTRAINT "PushSubscription_queueEntryId_fkey" 
        FOREIGN KEY ("queueEntryId") 
        REFERENCES "QueueEntry"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- Add trigger to update updatedAt timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON "PushSubscription"
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();