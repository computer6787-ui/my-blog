"""
Global Chat Cleanup Migration
This script sets up the daily cleanup for global messages.
Run this once to initialize the cleanup schedule.
"""
from datetime import datetime, timedelta, timezone
from backend.app.database import SessionLocal
from backend.app import models
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def cleanup_initial_setup():
    """Initial cleanup: Remove messages older than 24 hours"""
    try:
        db = SessionLocal()
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=24)
        
        # Count old messages
        old_count = db.query(models.GlobalMessage).filter(
            models.GlobalMessage.created_at < cutoff_time
        ).count()
        
        # Count total messages
        total_count = db.query(models.GlobalMessage).count()
        
        logger.info(f"📊 Global Chat Cleanup Report")
        logger.info(f"   Total messages: {total_count}")
        logger.info(f"   Messages older than 24h: {old_count}")
        logger.info(f"   Cutoff time: {cutoff_time.isoformat()}")
        
        if old_count > 0:
            db.query(models.GlobalMessage).filter(
                models.GlobalMessage.created_at < cutoff_time
            ).delete()
            db.commit()
            logger.info(f"   ✅ Deleted {old_count} old messages")
        else:
            logger.info(f"   ✅ No messages to delete")
        
        # Show current state
        remaining = db.query(models.GlobalMessage).count()
        logger.info(f"   Remaining messages: {remaining}")
        
        db.close()
        return {"deleted": old_count, "remaining": remaining}
        
    except Exception as e:
        logger.error(f"❌ Error during cleanup: {e}")
        db.rollback()
        db.close()
        raise


if __name__ == "__main__":
    logger.info("🚀 Starting global chat cleanup migration...")
    result = cleanup_initial_setup()
    logger.info(f"✅ Migration complete: {result}")
