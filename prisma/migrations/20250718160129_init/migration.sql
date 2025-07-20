-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('restaurant', 'retail');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('free', 'basic', 'premium', 'enterprise');

-- CreateEnum
CREATE TYPE "QueueEntryStatus" AS ENUM ('waiting', 'called', 'serving', 'completed', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('whatsapp', 'messenger', 'web');

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "businessType" "BusinessType" NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerificationToken" TEXT,
    "passwordResetToken" TEXT,
    "passwordResetExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantAddress" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "street" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT,

    CONSTRAINT "MerchantAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessHours" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "start" TEXT,
    "end" TEXT,
    "closed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BusinessHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceType" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "estimatedDuration" INTEGER NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantIntegrations" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsappPhoneNumber" TEXT,
    "whatsappSessionData" TEXT,
    "whatsappLastConnected" TIMESTAMP(3),
    "messengerEnabled" BOOLEAN NOT NULL DEFAULT false,
    "messengerPageId" TEXT,
    "messengerAccessToken" TEXT,
    "messengerLastConnected" TIMESTAMP(3),

    CONSTRAINT "MerchantIntegrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantSettings" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "seatingCapacity" INTEGER NOT NULL DEFAULT 50,
    "avgMealDuration" INTEGER NOT NULL DEFAULT 45,
    "maxQueueSize" INTEGER NOT NULL DEFAULT 50,
    "autoPauseThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "noShowTimeout" INTEGER NOT NULL DEFAULT 15,
    "gracePeriod" INTEGER NOT NULL DEFAULT 5,
    "joinCutoffTime" INTEGER NOT NULL DEFAULT 30,
    "advanceBookingHours" INTEGER NOT NULL DEFAULT 0,
    "partySizeRegularMin" INTEGER NOT NULL DEFAULT 1,
    "partySizeRegularMax" INTEGER NOT NULL DEFAULT 8,
    "partySizePeakMin" INTEGER NOT NULL DEFAULT 1,
    "partySizePeakMax" INTEGER NOT NULL DEFAULT 4,
    "firstNotification" INTEGER NOT NULL DEFAULT 10,
    "finalNotification" INTEGER NOT NULL DEFAULT 0,
    "adjustForPeakHours" BOOLEAN NOT NULL DEFAULT true,
    "sendNoShowWarning" BOOLEAN NOT NULL DEFAULT true,
    "confirmTableAcceptance" BOOLEAN NOT NULL DEFAULT true,
    "peakHours" JSONB,
    "peakMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "priorityEnabled" BOOLEAN NOT NULL DEFAULT false,
    "prioritySlots" INTEGER NOT NULL DEFAULT 2,
    "prioritySkipRegular" BOOLEAN NOT NULL DEFAULT false,
    "priorityNotifyFirst" BOOLEAN NOT NULL DEFAULT true,
    "priorityLongerGrace" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MerchantSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "settingsId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "template" TEXT NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantSubscription" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'free',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxQueues" INTEGER NOT NULL DEFAULT 1,
    "maxCustomersPerQueue" INTEGER NOT NULL DEFAULT 50,
    "aiFeatures" BOOLEAN NOT NULL DEFAULT false,
    "analytics" BOOLEAN NOT NULL DEFAULT false,
    "customBranding" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MerchantSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Queue" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxCapacity" INTEGER NOT NULL DEFAULT 100,
    "averageServiceTime" INTEGER NOT NULL DEFAULT 15,
    "currentServing" INTEGER NOT NULL DEFAULT 0,
    "autoNotifications" BOOLEAN NOT NULL DEFAULT true,
    "notificationInterval" INTEGER NOT NULL DEFAULT 5,
    "allowCancellation" BOOLEAN NOT NULL DEFAULT true,
    "requireConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "businessHoursStart" TEXT NOT NULL DEFAULT '09:00',
    "businessHoursEnd" TEXT NOT NULL DEFAULT '17:00',
    "businessHoursTimezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueEntry" (
    "id" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "position" INTEGER NOT NULL,
    "estimatedWaitTime" INTEGER,
    "status" "QueueEntryStatus" NOT NULL DEFAULT 'waiting',
    "priority" "Priority" NOT NULL DEFAULT 'normal',
    "serviceTypeId" TEXT,
    "partySize" SMALLINT NOT NULL DEFAULT 1,
    "notes" TEXT,
    "specialRequests" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calledAt" TIMESTAMP(3),
    "servedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "requeuedAt" TIMESTAMP(3),
    "lastNotified" TIMESTAMP(3),
    "notificationCount" INTEGER NOT NULL DEFAULT 0,
    "sentimentScore" DOUBLE PRECISION,

    CONSTRAINT "QueueEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueEntryFeedback" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "rating" SMALLINT,
    "comment" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueueEntryFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueAnalytics" (
    "id" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "totalServed" INTEGER NOT NULL DEFAULT 0,
    "averageWaitTime" DOUBLE PRECISION,
    "averageServiceTime" DOUBLE PRECISION,
    "customerSatisfaction" DOUBLE PRECISION,
    "noShowRate" DOUBLE PRECISION,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueueAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sid" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_email_key" ON "Merchant"("email");

-- CreateIndex
CREATE INDEX "Merchant_email_idx" ON "Merchant"("email");

-- CreateIndex
CREATE INDEX "Merchant_businessName_idx" ON "Merchant"("businessName");

-- CreateIndex
CREATE INDEX "Merchant_businessType_idx" ON "Merchant"("businessType");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantAddress_merchantId_key" ON "MerchantAddress"("merchantId");

-- CreateIndex
CREATE INDEX "BusinessHours_merchantId_idx" ON "BusinessHours"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessHours_merchantId_dayOfWeek_key" ON "BusinessHours"("merchantId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "ServiceType_merchantId_idx" ON "ServiceType"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantIntegrations_merchantId_key" ON "MerchantIntegrations"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantSettings_merchantId_key" ON "MerchantSettings"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_settingsId_type_key" ON "NotificationTemplate"("settingsId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantSubscription_merchantId_key" ON "MerchantSubscription"("merchantId");

-- CreateIndex
CREATE INDEX "Queue_merchantId_isActive_idx" ON "Queue"("merchantId", "isActive");

-- CreateIndex
CREATE INDEX "Queue_merchantId_createdAt_idx" ON "Queue"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "QueueEntry_queueId_status_joinedAt_idx" ON "QueueEntry"("queueId", "status", "joinedAt");

-- CreateIndex
CREATE INDEX "QueueEntry_customerId_status_idx" ON "QueueEntry"("customerId", "status");

-- CreateIndex
CREATE INDEX "QueueEntry_status_position_idx" ON "QueueEntry"("status", "position");

-- CreateIndex
CREATE INDEX "QueueEntry_joinedAt_idx" ON "QueueEntry"("joinedAt" DESC);

-- CreateIndex
CREATE INDEX "QueueEntry_platform_joinedAt_idx" ON "QueueEntry"("platform", "joinedAt");

-- CreateIndex
CREATE UNIQUE INDEX "QueueEntryFeedback_entryId_key" ON "QueueEntryFeedback"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "QueueAnalytics_queueId_key" ON "QueueAnalytics"("queueId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sid_key" ON "Session"("sid");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- AddForeignKey
ALTER TABLE "MerchantAddress" ADD CONSTRAINT "MerchantAddress_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessHours" ADD CONSTRAINT "BusinessHours_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceType" ADD CONSTRAINT "ServiceType_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantIntegrations" ADD CONSTRAINT "MerchantIntegrations_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantSettings" ADD CONSTRAINT "MerchantSettings_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationTemplate" ADD CONSTRAINT "NotificationTemplate_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "MerchantSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantSubscription" ADD CONSTRAINT "MerchantSubscription_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Queue" ADD CONSTRAINT "Queue_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "Queue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntryFeedback" ADD CONSTRAINT "QueueEntryFeedback_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "QueueEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueAnalytics" ADD CONSTRAINT "QueueAnalytics_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "Queue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
