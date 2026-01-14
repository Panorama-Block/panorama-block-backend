DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'tac_service') THEN
    CREATE ROLE tac_service WITH LOGIN PASSWORD 'tac_service_password';
  END IF;

  IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'tac_service') THEN
    CREATE DATABASE tac_service OWNER tac_service;
  END IF;
END $$;

\connect tac_service

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
