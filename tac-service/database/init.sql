-- TAC Service Database Initialization
-- This script sets up the PostgreSQL database for TAC service

-- Create database (this is handled by docker-compose)
-- CREATE DATABASE tac_db;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- For composite indexes

-- Create custom types for better data validation
CREATE TYPE operation_status AS ENUM (
  'initiated',
  'bridging_to_evm',
  'executing_protocol',
  'bridging_back',
  'completed',
  'failed'
);

CREATE TYPE operation_type AS ENUM (
  'cross_chain_swap',
  'cross_chain_lending',
  'cross_chain_staking',
  'cross_chain_yield_farming'
);

CREATE TYPE step_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'failed'
);

CREATE TYPE notification_type AS ENUM (
  'operation_started',
  'operation_progress',
  'operation_completed',
  'operation_failed',
  'balance_updated',
  'rewards_available',
  'system_alert',
  'security_alert'
);

-- Performance optimization indexes (will be created by Prisma, but defined here for reference)
-- These are in addition to the indexes defined in schema.prisma

-- Function to automatically update 'updatedAt' timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW."updatedAt" = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language plpgsql;

-- Function to calculate operation duration
CREATE OR REPLACE FUNCTION calculate_operation_duration()
RETURNS TRIGGER AS $$
BEGIN
   IF NEW."completedAt" IS NOT NULL AND NEW."startedAt" IS NOT NULL THEN
       NEW."actualTime" = EXTRACT(EPOCH FROM (NEW."completedAt" - NEW."startedAt")) * 1000; -- in milliseconds
   END IF;
   RETURN NEW;
END;
$$ language plpgsql;

-- Function to validate balance amounts
CREATE OR REPLACE FUNCTION validate_balance_amount()
RETURNS TRIGGER AS $$
BEGIN
   IF NEW.balance < 0 THEN
       RAISE EXCEPTION 'Balance cannot be negative';
   END IF;

   IF NEW."rewardsEarned" < 0 THEN
       RAISE EXCEPTION 'Rewards earned cannot be negative';
   END IF;

   IF NEW."rewardsClaimed" < 0 THEN
       RAISE EXCEPTION 'Rewards claimed cannot be negative';
   END IF;

   IF NEW."rewardsClaimed" > NEW."rewardsEarned" THEN
       RAISE EXCEPTION 'Rewards claimed cannot exceed rewards earned';
   END IF;

   RETURN NEW;
END;
$$ language plpgsql;

-- Create a materialized view for analytics (will be refreshed periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS operation_analytics_daily AS
SELECT
    DATE("createdAt") as date,
    "operationType",
    "sourceChain",
    "targetChain",
    "protocol",
    COUNT(*) as total_operations,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_operations,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_operations,
    ROUND(AVG(CASE WHEN "actualTime" IS NOT NULL THEN "actualTime" END), 2) as avg_duration_ms,
    SUM(CASE WHEN "inputAmount" IS NOT NULL THEN "inputAmount" ELSE 0 END) as total_volume
FROM "TacOperation"
GROUP BY DATE("createdAt"), "operationType", "sourceChain", "targetChain", "protocol"
ORDER BY date DESC;

-- Create index on the materialized view
CREATE INDEX IF NOT EXISTS idx_operation_analytics_daily_date ON operation_analytics_daily(date);
CREATE INDEX IF NOT EXISTS idx_operation_analytics_daily_type ON operation_analytics_daily("operationType");

-- Create a function to refresh analytics
CREATE OR REPLACE FUNCTION refresh_operation_analytics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW operation_analytics_daily;
END;
$$ language plpgsql;

-- Create indexes for better query performance (complementing Prisma indexes)
-- Note: These will be created after Prisma tables are generated

-- Composite indexes for common queries
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tac_operation_user_status_created
-- ON "TacOperation"("userId", "status", "createdAt" DESC);

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tac_operation_chains_protocol
-- ON "TacOperation"("sourceChain", "targetChain", "protocol");

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tac_balance_user_active_protocol
-- ON "TacBalance"("userId", "isActive", "sourceProtocol");

-- Partial indexes for active records
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tac_balance_active_users
-- ON "TacBalance"("userId") WHERE "isActive" = true;

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tac_operation_pending
-- ON "TacOperation"("createdAt" DESC) WHERE "status" IN ('initiated', 'bridging_to_evm', 'executing_protocol', 'bridging_back');

-- GIN indexes for JSON columns (for better JSON queries)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tac_operation_steps_gin
-- ON "TacOperation" USING GIN("steps");

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tac_step_metadata_gin
-- ON "TacStep" USING GIN("metadata");

-- Create a function to cleanup old data (to be called by a cron job)
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- Delete expired quotes older than 24 hours
    DELETE FROM "CrossChainQuote"
    WHERE "expiresAt" < NOW() - INTERVAL '24 hours';

    -- Delete old analytics data older than 6 months
    DELETE FROM "TacAnalytics"
    WHERE "date" < NOW() - INTERVAL '6 months';

    -- Delete old events older than 30 days if processed
    DELETE FROM "TacEvent"
    WHERE "processedAt" < NOW() - INTERVAL '30 days' AND "processed" = true;

    -- Delete old notifications older than 7 days
    DELETE FROM "TacNotification"
    WHERE "createdAt" < NOW() - INTERVAL '7 days';

    -- Vacuum analyze to reclaim space
    VACUUM ANALYZE;
END;
$$ language plpgsql;

-- Grant necessary permissions
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO tac_service_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO tac_service_user;

-- Initialize configuration data
INSERT INTO "TacBridgeProvider" ("id", "name", "displayName", "endpoint", "isActive", "supportedChains", "supportedTokens")
VALUES
    (uuid_generate_v4(), 'tac', 'TAC Bridge', 'https://api.tac.build', true, '["ethereum", "avalanche", "base", "optimism"]', '["USDT", "USDC", "ETH", "AVAX"]'),
    (uuid_generate_v4(), 'layerzero', 'LayerZero', 'https://api.layerzero.network', false, '["ethereum", "avalanche", "base", "optimism"]', '["USDT", "USDC", "ETH"]'),
    (uuid_generate_v4(), 'axelar', 'Axelar Network', 'https://api.axelar.dev', false, '["ethereum", "avalanche", "base"]', '["USDT", "USDC", "ETH", "AVAX"]')
ON CONFLICT DO NOTHING;