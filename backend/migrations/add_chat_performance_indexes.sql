-- Chat Performance Optimization Indexes
-- Created: 2026-09-04
-- Purpose: Add composite indexes to prevent server crashes with large datasets

-- Global Messages: Optimize pagination queries (ORDER BY created_at DESC with LIMIT)
CREATE INDEX IF NOT EXISTS idx_global_messages_created_at_id 
ON global_messages(created_at DESC, id DESC);

-- Private Messages: Optimize conversation queries (both users + timestamp)
CREATE INDEX IF NOT EXISTS idx_private_messages_sender_receiver_created 
ON private_messages(sender_id, receiver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_private_messages_receiver_sender_created 
ON private_messages(receiver_id, sender_id, created_at DESC);

-- Private Messages: Optimize unread count queries
CREATE INDEX IF NOT EXISTS idx_private_messages_receiver_unread 
ON private_messages(receiver_id, is_read, created_at DESC);

-- Users: Optimize search queries (name and email ILIKE)
CREATE INDEX IF NOT EXISTS idx_users_name_lower 
ON users(LOWER(name));

CREATE INDEX IF NOT EXISTS idx_users_email_lower 
ON users(LOWER(email));

-- Users: Optimize active user filtering
CREATE INDEX IF NOT EXISTS idx_users_active_name 
ON users(is_active, name) WHERE is_active = TRUE;

-- Analyze tables after creating indexes
ANALYZE global_messages;
ANALYZE private_messages;
ANALYZE users;
