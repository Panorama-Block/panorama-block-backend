-- CreateTable
CREATE TABLE "ProtocolFeeConfig" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "taxInPercent" DECIMAL(10,6) NOT NULL,
    "taxInBips" INTEGER,
    "taxInEth" DECIMAL(36,18),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtocolFeeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolFeeConfig_provider_key" ON "ProtocolFeeConfig"("provider");

-- CreateIndex
CREATE INDEX "ProtocolFeeConfig_provider_isActive_idx" ON "ProtocolFeeConfig"("provider", "isActive");
