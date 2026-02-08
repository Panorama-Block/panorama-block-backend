SELECT 'CREATE ROLE tac_service WITH LOGIN PASSWORD ''tac_service_password''' 
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'tac_service') \gexec

SELECT 'CREATE DATABASE tac_service OWNER tac_service'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'tac_service') \gexec

\connect tac_service

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
