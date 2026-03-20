-- Step 1: Add userId column to Transaction (nullable first)
ALTER TABLE "Transaction" ADD COLUMN "userId" TEXT;

-- Step 2: Populate userId from BankStatement -> User relationship
-- Get the first user from the organization that owns the bank statement
UPDATE "Transaction" t
SET "userId" = u.id
FROM "BankStatement" bs
JOIN "User" u ON u."organizationId" = bs."organizationId"
WHERE t."bankStatementId" = bs.id
AND t."userId" IS NULL;

-- Step 3: For any remaining NULL userIds, use the first available user
UPDATE "Transaction"
SET "userId" = (SELECT id FROM "User" LIMIT 1)
WHERE "userId" IS NULL;

-- Step 4: Make userId NOT NULL
ALTER TABLE "Transaction" ALTER COLUMN "userId" SET NOT NULL;

-- Step 5: Add foreign key constraint
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 6: Create index on userId for better query performance
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- Step 7: Drop the organizationId column from BankStatement
ALTER TABLE "BankStatement" DROP COLUMN "organizationId";

-- Step 8: Drop the BankStatement -> Organization relation from Organization table (if exists)
-- This removes the backward relation
