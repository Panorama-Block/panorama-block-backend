-- Lending + Lido tables for the database gateway
-- This migration is intentionally idempotent to be safe across mixed local states.

CREATE TABLE IF NOT EXISTS "LendingMarket" (
    "marketId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "protocol" TEXT NOT NULL DEFAULT 'benqi',
    "qTokenAddress" TEXT NOT NULL,
    "qTokenSymbol" TEXT NOT NULL,
    "underlyingAddress" TEXT NOT NULL,
    "underlyingSymbol" TEXT NOT NULL,
    "underlyingDecimals" INTEGER NOT NULL DEFAULT 18,
    "collateralFactorBps" INTEGER,
    "liquidationIncentiveBps" INTEGER,
    "supplyApyBps" INTEGER,
    "borrowApyBps" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "LendingMarket_pkey" PRIMARY KEY ("marketId")
);

CREATE TABLE IF NOT EXISTS "LendingPosition" (
    "positionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "suppliedWei" TEXT NOT NULL DEFAULT '0',
    "borrowedWei" TEXT NOT NULL DEFAULT '0',
    "collateralEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "LendingPosition_pkey" PRIMARY KEY ("positionId")
);

CREATE TABLE IF NOT EXISTS "LendingSnapshotDaily" (
    "snapshotId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalSuppliedWei" TEXT NOT NULL DEFAULT '0',
    "totalBorrowedWei" TEXT NOT NULL DEFAULT '0',
    "liquidityWei" TEXT DEFAULT '0',
    "shortfallWei" TEXT DEFAULT '0',
    "healthFactor" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "LendingSnapshotDaily_pkey" PRIMARY KEY ("snapshotId")
);

CREATE TABLE IF NOT EXISTS "LendingTx" (
    "txId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "amountWei" TEXT,
    "txHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "LendingTx_pkey" PRIMARY KEY ("txId")
);

CREATE TABLE IF NOT EXISTS "LidoPosition" (
    "positionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL DEFAULT 1,
    "stethWei" TEXT NOT NULL DEFAULT '0',
    "wstethWei" TEXT NOT NULL DEFAULT '0',
    "apyBps" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "LidoPosition_pkey" PRIMARY KEY ("positionId")
);

CREATE TABLE IF NOT EXISTS "LidoWithdrawal" (
    "withdrawalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL DEFAULT 1,
    "requestId" TEXT NOT NULL,
    "amountStEthWei" TEXT NOT NULL,
    "finalized" BOOLEAN NOT NULL DEFAULT false,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "requestedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "LidoWithdrawal_pkey" PRIMARY KEY ("withdrawalId")
);

CREATE TABLE IF NOT EXISTS "LidoTx" (
    "txId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL DEFAULT 1,
    "action" TEXT NOT NULL,
    "amountWei" TEXT,
    "txHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "LidoTx_pkey" PRIMARY KEY ("txId")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LendingMarket_chainId_qTokenAddress_tenantId_key"
  ON "LendingMarket"("chainId", "qTokenAddress", "tenantId");

CREATE INDEX IF NOT EXISTS "LendingMarket_chainId_protocol_idx"
  ON "LendingMarket"("chainId", "protocol");

CREATE UNIQUE INDEX IF NOT EXISTS "LendingPosition_userId_marketId_tenantId_key"
  ON "LendingPosition"("userId", "marketId", "tenantId");

CREATE INDEX IF NOT EXISTS "LendingPosition_userId_updatedAt_idx"
  ON "LendingPosition"("userId", "updatedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "LendingSnapshotDaily_userId_chainId_date_tenantId_key"
  ON "LendingSnapshotDaily"("userId", "chainId", "date", "tenantId");

CREATE INDEX IF NOT EXISTS "LendingSnapshotDaily_userId_date_idx"
  ON "LendingSnapshotDaily"("userId", "date");

CREATE INDEX IF NOT EXISTS "LendingTx_userId_createdAt_idx"
  ON "LendingTx"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "LendingTx_txHash_idx"
  ON "LendingTx"("txHash");

CREATE UNIQUE INDEX IF NOT EXISTS "LidoPosition_userId_chainId_tenantId_key"
  ON "LidoPosition"("userId", "chainId", "tenantId");

CREATE INDEX IF NOT EXISTS "LidoPosition_userId_updatedAt_idx"
  ON "LidoPosition"("userId", "updatedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "LidoWithdrawal_userId_chainId_requestId_tenantId_key"
  ON "LidoWithdrawal"("userId", "chainId", "requestId", "tenantId");

CREATE INDEX IF NOT EXISTS "LidoWithdrawal_userId_finalized_claimed_idx"
  ON "LidoWithdrawal"("userId", "finalized", "claimed");

CREATE INDEX IF NOT EXISTS "LidoTx_userId_createdAt_idx"
  ON "LidoTx"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "LidoTx_txHash_idx"
  ON "LidoTx"("txHash");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LendingPosition_userId_fkey'
  ) THEN
    ALTER TABLE "LendingPosition"
      ADD CONSTRAINT "LendingPosition_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("userId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LendingPosition_marketId_fkey'
  ) THEN
    ALTER TABLE "LendingPosition"
      ADD CONSTRAINT "LendingPosition_marketId_fkey"
      FOREIGN KEY ("marketId") REFERENCES "LendingMarket"("marketId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LendingSnapshotDaily_userId_fkey'
  ) THEN
    ALTER TABLE "LendingSnapshotDaily"
      ADD CONSTRAINT "LendingSnapshotDaily_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("userId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LendingTx_userId_fkey'
  ) THEN
    ALTER TABLE "LendingTx"
      ADD CONSTRAINT "LendingTx_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("userId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LidoPosition_userId_fkey'
  ) THEN
    ALTER TABLE "LidoPosition"
      ADD CONSTRAINT "LidoPosition_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("userId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LidoWithdrawal_userId_fkey'
  ) THEN
    ALTER TABLE "LidoWithdrawal"
      ADD CONSTRAINT "LidoWithdrawal_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("userId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LidoTx_userId_fkey'
  ) THEN
    ALTER TABLE "LidoTx"
      ADD CONSTRAINT "LidoTx_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("userId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
