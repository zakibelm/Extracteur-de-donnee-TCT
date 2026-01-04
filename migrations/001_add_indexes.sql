-- Migration: Add Performance Indexes
-- Description: Optimizes query performance for extractions table
-- Date: 2026-01-04

-- Index for fetching user extractions (most common query)
CREATE INDEX IF NOT EXISTS idx_extractions_user_id
ON extractions(userId);

-- Composite index for user + section filtering
CREATE INDEX IF NOT EXISTS idx_extractions_user_section
ON extractions(userId, section);

-- Index for ordering by creation date
CREATE INDEX IF NOT EXISTS idx_extractions_created_desc
ON extractions(createdAt DESC);

-- Index for user authentication lookups
CREATE INDEX IF NOT EXISTS idx_users_num_dome
ON users(numDome);

-- Analyze tables for query planner
ANALYZE users;
ANALYZE extractions;
