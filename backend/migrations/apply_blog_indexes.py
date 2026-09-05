"""
Blog Hot-Path Performance Indexes - Apply Script
Adds indexes for the blog listing/detail hot path and ILIKE search.

Usage:
    python -m backend.migrations.apply_blog_indexes
"""
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import text
from backend.app.database import engine


def load_sql() -> str:
    sql_path = Path(__file__).with_name("add_blog_performance_indexes.sql")
    return sql_path.read_text(encoding="utf-8")


def apply_indexes():
    """Apply blog hot-path performance indexes."""
    print("🔧 Applying blog performance indexes...")

    with engine.connect() as conn:
        # Strip `--` comment lines BEFORE splitting on ';' so comment-prefixed
        # statements are not dropped (the earlier chat script had this bug).
        sql = load_sql()
        clean = "\n".join(
            line for line in sql.splitlines() if not line.strip().startswith("--")
        )
        statements = [s.strip() for s in clean.split(";") if s.strip()]

        applied = 0
        for i, statement in enumerate(statements, 1):
            try:
                print(f"   [{i}/{len(statements)}] Executing...")
                conn.execute(text(statement))
                conn.commit()
                applied += 1
                print(f"   ✅ OK")
            except Exception as e:
                print(f"   ⚠️  Warning: {e}")

    print(f"\n✅ Blog performance indexes applied ({applied}/{len(statements)} statements).")
    print("\nBenefits:")
    print("  - Blog listing: index-backed pagination (published, id DESC)")
    print("  - Likes/comments counts: index-backed GROUP BY instead of seq scans")
    print("  - Search: pg_trgm GIN indexes speed up ILIKE '%term%' queries")
    print("  - Notifications: per-user feed is index-backed")


if __name__ == "__main__":
    try:
        apply_indexes()
    except Exception as e:
        print(f"\n❌ Error applying indexes: {e}")
        sys.exit(1)
