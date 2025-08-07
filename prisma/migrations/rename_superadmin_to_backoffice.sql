-- Rename SuperAdmin table to BackOfficeUser
ALTER TABLE "SuperAdmin" RENAME TO "BackOfficeUser";

-- Rename SuperAdminAuditLog table to BackOfficeAuditLog  
ALTER TABLE "SuperAdminAuditLog" RENAME TO "BackOfficeAuditLog";

-- Rename the foreign key column in BackOfficeAuditLog
ALTER TABLE "BackOfficeAuditLog" RENAME COLUMN "superAdminId" TO "backOfficeUserId";

-- Update the foreign key constraint name
ALTER TABLE "BackOfficeAuditLog" 
  DROP CONSTRAINT IF EXISTS "SuperAdminAuditLog_superAdminId_fkey";

ALTER TABLE "BackOfficeAuditLog"
  ADD CONSTRAINT "BackOfficeAuditLog_backOfficeUserId_fkey" 
  FOREIGN KEY ("backOfficeUserId") 
  REFERENCES "BackOfficeUser"("id") 
  ON DELETE SET NULL;

-- Update indexes to match new column names
DROP INDEX IF EXISTS "SuperAdminAuditLog_superAdminId_timestamp_idx";
CREATE INDEX "BackOfficeAuditLog_backOfficeUserId_timestamp_idx" 
  ON "BackOfficeAuditLog"("backOfficeUserId", "timestamp");