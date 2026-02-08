-- Lido Service schema (PostgreSQL)
-- This schema is designed to persist user positions, transactions and withdrawal queue requests.
-- It is intentionally minimal but extensible for portfolio/yield analytics.

-- Users
CREATE TABLE IF NOT EXISTS lido_users (
  address VARCHAR(42) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Current position (latest snapshot)
CREATE TABLE IF NOT EXISTS lido_positions_current (
  address VARCHAR(42) PRIMARY KEY REFERENCES lido_users(address) ON DELETE CASCADE,
  chain_id INTEGER NOT NULL,
  steth_balance_wei NUMERIC(78,0) NOT NULL DEFAULT 0,
  wsteth_balance_wei NUMERIC(78,0) NOT NULL DEFAULT 0,
  total_staked_wei NUMERIC(78,0) NOT NULL DEFAULT 0,
  apy_bps INTEGER,
  block_number BIGINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Position snapshots for yield/portfolio analytics over time
CREATE TABLE IF NOT EXISTS lido_position_snapshots (
  id BIGSERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL REFERENCES lido_users(address) ON DELETE CASCADE,
  chain_id INTEGER NOT NULL,
  steth_balance_wei NUMERIC(78,0) NOT NULL DEFAULT 0,
  wsteth_balance_wei NUMERIC(78,0) NOT NULL DEFAULT 0,
  total_staked_wei NUMERIC(78,0) NOT NULL DEFAULT 0,
  apy_bps INTEGER,
  block_number BIGINT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lido_position_snapshots_address_time
  ON lido_position_snapshots (address, captured_at DESC);

-- Transactions prepared/executed by the user (non-custodial flow)
CREATE TABLE IF NOT EXISTS lido_transactions (
  id TEXT PRIMARY KEY,
  address VARCHAR(42) NOT NULL REFERENCES lido_users(address) ON DELETE CASCADE,
  chain_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  token TEXT NOT NULL,
  amount_wei NUMERIC(78,0) NOT NULL,
  amount_input TEXT NOT NULL,
  status TEXT NOT NULL,
  tx_hash TEXT,
  tx_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lido_transactions_address_created_at
  ON lido_transactions (address, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lido_transactions_tx_hash
  ON lido_transactions (tx_hash);

-- Withdrawal Queue requests (Lido unstake flow)
CREATE TABLE IF NOT EXISTS lido_withdrawal_requests (
  request_id NUMERIC(78,0) PRIMARY KEY,
  address VARCHAR(42) NOT NULL REFERENCES lido_users(address) ON DELETE CASCADE,
  amount_steth_wei NUMERIC(78,0) NOT NULL DEFAULT 0,
  amount_shares NUMERIC(78,0) NOT NULL DEFAULT 0,
  request_timestamp BIGINT NOT NULL,
  is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
  is_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lido_withdrawal_requests_address
  ON lido_withdrawal_requests (address);

-- Portfolio assets (current balances per token)
CREATE TABLE IF NOT EXISTS lido_portfolio_assets (
  address VARCHAR(42) NOT NULL REFERENCES lido_users(address) ON DELETE CASCADE,
  chain_id INTEGER NOT NULL,
  token_symbol TEXT NOT NULL,
  token_address VARCHAR(42) NOT NULL,
  balance_wei NUMERIC(78,0) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (address, chain_id, token_address)
);

CREATE INDEX IF NOT EXISTS idx_lido_portfolio_assets_address
  ON lido_portfolio_assets (address);

-- Portfolio daily metrics (derived from snapshots; stored once per day)
CREATE TABLE IF NOT EXISTS lido_portfolio_metrics_daily (
  address VARCHAR(42) NOT NULL REFERENCES lido_users(address) ON DELETE CASCADE,
  chain_id INTEGER NOT NULL,
  date DATE NOT NULL,
  steth_balance_wei NUMERIC(78,0) NOT NULL DEFAULT 0,
  wsteth_balance_wei NUMERIC(78,0) NOT NULL DEFAULT 0,
  total_staked_wei NUMERIC(78,0) NOT NULL DEFAULT 0,
  apy_bps INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (address, chain_id, date)
);

CREATE INDEX IF NOT EXISTS idx_lido_portfolio_metrics_daily_address_date
  ON lido_portfolio_metrics_daily (address, date DESC);

-- Optional: link wallet address to Telegram user / tenant (if you want to unify user identity across systems)
CREATE TABLE IF NOT EXISTS lido_user_links (
  address VARCHAR(42) PRIMARY KEY REFERENCES lido_users(address) ON DELETE CASCADE,
  telegram_user_id TEXT,
  tenant_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
