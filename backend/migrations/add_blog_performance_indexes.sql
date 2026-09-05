-- Blog Hot-Path Performance Indexes
-- Created: 2026-09-05
-- Purpose: Index the blog listing/detail hot path (blogs, likes, comments,
-- mentions, notifications) plus trigram GIN indexes for ILIKE search.
-- Postgres does NOT auto-index foreign-key columns, so the FK lookups below
-- currently fall back to sequential scans as these tables grow.

-- Blog listing: filter published + order by newest first
CREATE INDEX IF NOT EXISTS idx_blogs_published_id
ON blogs(published, id DESC);

-- Blog -> creator lookup (detail page, profile pages)
CREATE INDEX IF NOT EXISTS idx_blogs_user_id
ON blogs(user_id);

-- Likes / comments counts and existence checks
CREATE INDEX IF NOT EXISTS idx_likes_blog_id
ON likes(blog_id);

CREATE INDEX IF NOT EXISTS idx_likes_user_id
ON likes(user_id);

CREATE INDEX IF NOT EXISTS idx_comments_blog_id
ON comments(blog_id);

CREATE INDEX IF NOT EXISTS idx_comments_user_id
ON comments(user_id);

-- Threaded comments
CREATE INDEX IF NOT EXISTS idx_comments_parent_id
ON comments(parent_id);

-- Mentions: resolve notifications for a comment / user
CREATE INDEX IF NOT EXISTS idx_mentions_comment_id
ON mentions(comment_id);

CREATE INDEX IF NOT EXISTS idx_mentions_mentioned_user
ON mentions(mentioned_user_id);

-- Notification feed: per-user, newest first
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
ON notifications(user_id, created_at DESC);

-- ILIKE '%term%' search over title + body (trigram GIN)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_blogs_title_trgm
ON blogs USING gin(title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_blogs_body_trgm
ON blogs USING gin(body gin_trgm_ops);

-- Refresh planner stats after creating indexes
ANALYZE blogs;
ANALYZE likes;
ANALYZE comments;
ANALYZE mentions;
ANALYZE notifications;
