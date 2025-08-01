-- Add session recovery fields to QueueEntry
ALTER TABLE "QueueEntry" 
ADD COLUMN "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "sessionExpiresAt" TIMESTAMP(3);

-- Create index for session expiration queries
CREATE INDEX "QueueEntry_sessionExpiresAt_idx" ON "QueueEntry"("sessionExpiresAt");

-- Create WebChatSession table for session management
CREATE TABLE "WebChatSession" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "queueEntryId" TEXT NOT NULL,
    "browserInfo" TEXT,
    "ipAddress" TEXT,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionExpiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "recoveryToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebChatSession_pkey" PRIMARY KEY ("id")
);

-- Create unique indexes
CREATE UNIQUE INDEX "WebChatSession_sessionId_key" ON "WebChatSession"("sessionId");
CREATE UNIQUE INDEX "WebChatSession_recoveryToken_key" ON "WebChatSession"("recoveryToken");

-- Create regular indexes
CREATE INDEX "WebChatSession_sessionId_idx" ON "WebChatSession"("sessionId");
CREATE INDEX "WebChatSession_recoveryToken_idx" ON "WebChatSession"("recoveryToken");
CREATE INDEX "WebChatSession_sessionExpiresAt_idx" ON "WebChatSession"("sessionExpiresAt");
CREATE INDEX "WebChatSession_isActive_lastActivityAt_idx" ON "WebChatSession"("isActive", "lastActivityAt");

-- Add foreign key constraint
ALTER TABLE "WebChatSession" ADD CONSTRAINT "WebChatSession_queueEntryId_fkey" 
FOREIGN KEY ("queueEntryId") REFERENCES "QueueEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;