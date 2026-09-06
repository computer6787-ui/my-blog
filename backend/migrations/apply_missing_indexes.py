"""
Missing Performance Indexes - Apply Script
Adds indexes for user lookups, comment threads, like toggles, and unread notifications.

Usage:
    python -m backend.migrations.apply_missing_indexes
"""
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import text
from backend.app.database import engine


def load_sql() -> str:
    sql_path = Path(__file__).with_name("add_missing_indexes.sql")
    return sql_path.read_text(encoding="utf-8")


def apply_indexes():
    """Apply missing performance indexes."""
    print("[+] Applying missing performance indexes...")

    with engine.connect() as conn:
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
                print(f"   [OK] OK")
            except Exception as e:
                print(f"   ⚠️  Warning: {e}")

    print(f"\n[OK] Missing performance indexes applied ({applied}/{len(statements)} statements).")
    print("\nBenefits:")
    print("  - User lookups (login, auth, oauth, reset): index-backed exact email/name matches")
    print("  - Comment threads: ordered fetches by blog_id + created_at")
    print("  - Like toggles + counts: composite index avoids seq scans")
    print("  - Unread notification count: partial index on (user_id, is_read) WHERE is_read=FALSE")


if __name__ == "__main__":
    try:
        apply_indexes()
    except Exception as e:
        print(f"\n[!] Error applying indexes: {e}")
        sys.exit(1)