-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "nickname" TEXT,
    "investorType" TEXT,
    "goals" TEXT[],
    "preferredChains" TEXT[],
    "riskTolerance" INTEGER,
    "metadata" JSONB,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_walletAddress_key" ON "UserProfile"("walletAddress");

-- CreateIndex
CREATE INDEX "UserProfile_walletAddress_idx" ON "UserProfile"("walletAddress");

-- CreateIndex
CREATE INDEX "UserProfile_tenantId_idx" ON "UserProfile"("tenantId");
