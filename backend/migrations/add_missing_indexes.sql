-- Missing Performance Indexes (complements existing blog/chat index migrations)
-- Created: 2026-09-06
-- Purpose: Cover hot-path queries not addressed by earlier migrations.

-- Users: exact email lookups (login, auth, oauth, password reset)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Users: exact name lookups (mention resolution in comments)
CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);

-- Comments: blog_id + created_at for ordered thread fetches
CREATE INDEX IF NOT EXISTS idx_comments_blog_created ON comments(blog_id, created_at);

-- Likes: composite (blog_id, user_id) for existence check + counts
CREATE INDEX IF NOT EXISTS idx_likes_blog_user ON likes(blog_id, user_id);

-- Notifications: per-user unread count hot path (partial index on FALSE)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- Refresh planner stats after creating indexes
ANALYZE users;
ANALYZE comments;
ANALYZE likes;
ANALYZE notifications;