-- SQL commands to create gateway database
-- Run this in Railway PostgreSQL console or pgAdmin

-- Connect to Railway PostgreSQL and create gateway database
CREATE DATABASE gateway_db OWNER postgres;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE gateway_db TO postgres;

-- Verify database creation
\l