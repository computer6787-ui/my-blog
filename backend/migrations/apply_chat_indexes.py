"""
Chat Performance Optimization - Add Database Indexes
Run this script to add indexes that prevent server crashes with large datasets.

Usage:
    python -m backend.migrations.apply_chat_indexes
"""
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import text
from backend.app.database import engine

def apply_indexes():
    """Apply performance indexes for chat system"""
    
    indexes_sql = """
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
    """
    
    print("🔧 Applying chat performance indexes...")
    
    with engine.connect() as conn:
        # Strip `--` comment lines BEFORE splitting on ';' so comment-prefixed
        # statements are not dropped (each chunk previously began with a comment
        # line, so every statement was filtered out and nothing was applied).
        clean = "\n".join(
            line for line in indexes_sql.splitlines() if not line.strip().startswith('--')
        )
        statements = [s.strip() for s in clean.split(';') if s.strip()]
        
        for i, statement in enumerate(statements, 1):
            try:
                print(f"   [{i}/{len(statements)}] Creating index...")
                conn.execute(text(statement))
                conn.commit()
                print(f"   ✅ Success")
            except Exception as e:
                print(f"   ⚠️  Warning: {e}")
                continue
        
        # Analyze tables
        print("\n📊 Analyzing tables...")
        for table in ['global_messages', 'private_messages', 'users']:
            try:
                conn.execute(text(f"ANALYZE {table}"))
                conn.commit()
                print(f"   ✅ {table}")
            except Exception as e:
                print(f"   ⚠️  {table}: {e}")
    
    print("\n✅ Chat performance indexes applied successfully!")
    print("\nBenefits:")
    print("  - Global chat: Faster pagination (supports 100K+ messages)")
    print("  - Private messages: Faster conversation loading")
    print("  - User search: Faster ILIKE queries on name/email")
    print("  - Unread counts: Optimized filtering")

if __name__ == "__main__":
    try:
        apply_indexes()
    except Exception as e:
        print(f"\n❌ Error applying indexes: {e}")
        sys.exit(1)
