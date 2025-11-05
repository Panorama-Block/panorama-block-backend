-- CreateTable
CREATE TABLE "DcaSession" (
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "stage" TEXT,
    "event" TEXT,
    "intent" JSONB NOT NULL,
    "missingFields" TEXT[],
    "nextField" TEXT,
    "pendingQuestion" TEXT,
    "choices" JSONB,
    "errorMessage" TEXT,
    "historyCursor" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "DcaSession_pkey" PRIMARY KEY ("userId","conversationId")
);

-- CreateTable
CREATE TABLE "DcaHistory" (
    "historyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "summary" TEXT,
    "workflowType" TEXT,
    "cadence" JSONB,
    "tokens" JSONB,
    "amounts" JSONB,
    "strategy" JSONB,
    "venue" TEXT,
    "slippageBps" INTEGER,
    "stopConditions" JSONB,
    "metadata" JSONB,
    "errorMessage" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "DcaHistory_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "DcaWorkflow" (
    "workflowId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "walletAddress" TEXT,
    "status" TEXT NOT NULL,
    "strategyId" TEXT,
    "strategyVersion" TEXT,
    "strategyName" TEXT,
    "strategy" JSONB,
    "cadence" JSONB,
    "tokens" JSONB,
    "amounts" JSONB,
    "metadata" JSONB,
    "guardrails" JSONB,
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "DcaWorkflow_pkey" PRIMARY KEY ("workflowId")
);

-- CreateTable
CREATE TABLE "DcaRun" (
    "runId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "txHash" TEXT,
    "amountExecuted" JSONB,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "DcaRun_pkey" PRIMARY KEY ("runId")
);

-- CreateIndex
CREATE INDEX "DcaSession_userId_conversationId_updatedAt_idx" ON "DcaSession"("userId", "conversationId", "updatedAt");

-- CreateIndex
CREATE INDEX "DcaHistory_userId_conversationId_recordedAt_idx" ON "DcaHistory"("userId", "conversationId", "recordedAt");

-- CreateIndex
CREATE INDEX "DcaWorkflow_userId_status_idx" ON "DcaWorkflow"("userId", "status");

-- CreateIndex
CREATE INDEX "DcaWorkflow_nextRunAt_idx" ON "DcaWorkflow"("nextRunAt");

-- CreateIndex
CREATE INDEX "DcaRun_workflowId_executedAt_idx" ON "DcaRun"("workflowId", "executedAt");

-- AddForeignKey
ALTER TABLE "DcaSession" ADD CONSTRAINT "DcaSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DcaHistory" ADD CONSTRAINT "DcaHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DcaWorkflow" ADD CONSTRAINT "DcaWorkflow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DcaRun" ADD CONSTRAINT "DcaRun_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "DcaWorkflow"("workflowId") ON DELETE RESTRICT ON UPDATE CASCADE;
