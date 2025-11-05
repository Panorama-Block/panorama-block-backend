-- CreateTable
CREATE TABLE "User" (
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT,
    "displayName" TEXT,
    "attributes" JSONB,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentAgent" TEXT,
    "lastMessageId" TEXT,
    "contextState" JSONB NOT NULL DEFAULT '{}',
    "memoryState" JSONB NOT NULL DEFAULT '{}',
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "agentName" TEXT,
    "agentType" TEXT,
    "requiresAction" BOOLEAN NOT NULL DEFAULT false,
    "actionType" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'completed',
    "errorMessage" TEXT,
    "toolCalls" JSONB,
    "toolResults" JSONB,
    "nextAgent" TEXT,
    "requiresFollowup" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("messageId")
);

-- CreateTable
CREATE TABLE "MessageToolCall" (
    "toolCallId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "result" JSONB,
    "errorMessage" TEXT,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageToolCall_pkey" PRIMARY KEY ("toolCallId")
);

-- CreateTable
CREATE TABLE "AgentTurn" (
    "turnId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "agentType" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "AgentTurn_pkey" PRIMARY KEY ("turnId")
);

-- CreateTable
CREATE TABLE "AgentSharedState" (
    "agentName" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "state" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "AgentSharedState_pkey" PRIMARY KEY ("agentName","userId","conversationId")
);

-- CreateTable
CREATE TABLE "ConversationMemory" (
    "memoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "scope" TEXT NOT NULL,
    "memoryType" TEXT NOT NULL,
    "label" TEXT,
    "payload" JSONB NOT NULL,
    "embedding" BYTEA,
    "importanceScore" DOUBLE PRECISION,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "ConversationMemory_pkey" PRIMARY KEY ("memoryId")
);

-- CreateTable
CREATE TABLE "SwapSession" (
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "intent" JSONB NOT NULL,
    "missingFields" TEXT[],
    "nextField" TEXT,
    "pendingQuestion" TEXT,
    "choices" JSONB,
    "errorMessage" TEXT,
    "historyCursor" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "SwapSession_pkey" PRIMARY KEY ("userId","conversationId")
);

-- CreateTable
CREATE TABLE "SwapHistory" (
    "historyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "fromNetwork" TEXT,
    "fromToken" TEXT,
    "toNetwork" TEXT,
    "toToken" TEXT,
    "amount" DOUBLE PRECISION,
    "errorMessage" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "SwapHistory_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "AgentMetric" (
    "metricId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "agentType" TEXT,
    "userId" TEXT,
    "conversationId" TEXT,
    "responseTimeMs" INTEGER,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "tokensInput" INTEGER,
    "tokensOutput" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "AgentMetric_pkey" PRIMARY KEY ("metricId")
);

-- CreateTable
CREATE TABLE "Outbox" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "op" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_userId_conversationId_key" ON "Conversation"("userId", "conversationId");

-- CreateIndex
CREATE INDEX "Message_userId_conversationId_timestamp_idx" ON "Message"("userId", "conversationId", "timestamp");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_userId_conversationId_fkey" FOREIGN KEY ("userId", "conversationId") REFERENCES "Conversation"("userId", "conversationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageToolCall" ADD CONSTRAINT "MessageToolCall_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("messageId") ON DELETE RESTRICT ON UPDATE CASCADE;
