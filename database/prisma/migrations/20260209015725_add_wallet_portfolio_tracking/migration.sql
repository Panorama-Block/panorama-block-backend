-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "walletType" TEXT NOT NULL,
    "name" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "market" TEXT,
    "positionType" TEXT NOT NULL,
    "assetAddress" TEXT NOT NULL,
    "assetSymbol" TEXT NOT NULL,
    "assetDecimals" INTEGER NOT NULL,
    "amountRaw" TEXT NOT NULL,
    "amountDisplay" TEXT NOT NULL,
    "amountUsd" TEXT,
    "priceUsd" TEXT,
    "accruedRaw" TEXT,
    "accruedDisplay" TEXT,
    "apy" TEXT,
    "healthFactor" TEXT,
    "snapshotBlock" BIGINT,
    "snapshotTimestamp" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "metadata" JSONB,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PositionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "conversationId" TEXT,
    "action" TEXT NOT NULL,
    "protocol" TEXT,
    "fromChainId" INTEGER NOT NULL,
    "fromAssetAddress" TEXT NOT NULL,
    "fromAssetSymbol" TEXT NOT NULL,
    "fromAssetDecimals" INTEGER NOT NULL,
    "fromAmountRaw" TEXT NOT NULL,
    "fromAmountDisplay" TEXT NOT NULL,
    "fromAmountUsd" TEXT,
    "toChainId" INTEGER,
    "toAssetAddress" TEXT,
    "toAssetSymbol" TEXT,
    "toAssetDecimals" INTEGER,
    "toAmountRaw" TEXT,
    "toAmountDisplay" TEXT,
    "toAmountUsd" TEXT,
    "txHashes" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'created',
    "provider" TEXT,
    "gasFee" TEXT,
    "bridgeFee" TEXT,
    "protocolFee" TEXT,
    "totalFeeUsd" TEXT,
    "exchangeRate" TEXT,
    "slippage" TEXT,
    "priceImpact" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "bridgeId" TEXT,
    "metadata" JSONB,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "actionUrl" TEXT,
    "actionLabel" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Wallet_userId_isActive_idx" ON "Wallet"("userId", "isActive");

-- CreateIndex
CREATE INDEX "Wallet_chain_address_idx" ON "Wallet"("chain", "address");

-- CreateIndex
CREATE INDEX "Wallet_tenantId_idx" ON "Wallet"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_chain_address_key" ON "Wallet"("userId", "chain", "address");

-- CreateIndex
CREATE INDEX "PositionSnapshot_userId_snapshotTimestamp_idx" ON "PositionSnapshot"("userId", "snapshotTimestamp" DESC);

-- CreateIndex
CREATE INDEX "PositionSnapshot_walletId_protocol_idx" ON "PositionSnapshot"("walletId", "protocol");

-- CreateIndex
CREATE INDEX "PositionSnapshot_userId_chain_positionType_idx" ON "PositionSnapshot"("userId", "chain", "positionType");

-- CreateIndex
CREATE INDEX "PositionSnapshot_tenantId_idx" ON "PositionSnapshot"("tenantId");

-- CreateIndex
CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Transaction_walletId_action_idx" ON "Transaction"("walletId", "action");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_bridgeId_idx" ON "Transaction"("bridgeId");

-- CreateIndex
CREATE INDEX "Transaction_tenantId_idx" ON "Transaction"("tenantId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_userId_type_idx" ON "Notification"("userId", "type");

-- CreateIndex
CREATE INDEX "Notification_tenantId_idx" ON "Notification"("tenantId");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionSnapshot" ADD CONSTRAINT "PositionSnapshot_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
