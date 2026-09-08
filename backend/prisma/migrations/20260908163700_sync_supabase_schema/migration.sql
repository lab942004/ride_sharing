-- Create enums required by the current Prisma schema.
CREATE TYPE "AccountType" AS ENUM ('ORGANIZATION', 'GENERAL');
CREATE TYPE "IdentifierType" AS ENUM ('ROLL_OR_EMP_ID', 'SEQUENCE');
CREATE TYPE "DomainStatus" AS ENUM ('PENDING', 'ACTIVE');
CREATE TYPE "OrganizationType" AS ENUM ('ORGANIZATION', 'COLLEGE', 'COMPANY');

-- Add new domain fields while preserving existing domain rows.
ALTER TABLE "domains"
  ADD COLUMN "activatedAt" TIMESTAMP(3),
  ADD COLUMN "requestedAt" TIMESTAMP(3),
  ADD COLUMN "status" "DomainStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "type" "OrganizationType" NOT NULL DEFAULT 'ORGANIZATION';

-- Add replacement user fields as nullable during the data transition.
ALTER TABLE "users"
  ADD COLUMN "accountType" "AccountType" NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "identifier" TEXT,
  ADD COLUMN "identifierType" "IdentifierType";

-- Preserve every existing roll number/employee ID before removing rollNo.
UPDATE "users"
SET
  "identifier" = "rollNo",
  "identifierType" = CASE
    WHEN lower("email") LIKE '%@gmail.com' THEN 'SEQUENCE'::"IdentifierType"
    ELSE 'ROLL_OR_EMP_ID'::"IdentifierType"
  END,
  "accountType" = CASE
    WHEN lower("email") LIKE '%@gmail.com' THEN 'GENERAL'::"AccountType"
    ELSE 'ORGANIZATION'::"AccountType"
  END;

-- The preflight check confirmed all existing rollNo values are present and unique.
ALTER TABLE "users"
  ALTER COLUMN "identifier" SET NOT NULL,
  ALTER COLUMN "identifierType" SET NOT NULL;

DROP INDEX "users_rollNo_key";
ALTER TABLE "users" DROP COLUMN "rollNo";

CREATE INDEX "domains_status_idx" ON "domains"("status");
CREATE UNIQUE INDEX "users_identifier_key" ON "users"("identifier");
