"""
Global Chat Cleanup Service
Automatically deletes global messages older than 24 hours
Keeps private messages permanent
Runs daily via APScheduler
"""
import logging
from datetime import datetime, timedelta, timezone
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import delete
from backend.app import models
from backend.app.database import SessionLocal

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(daemon=True)


def cleanup_old_global_messages():
    """Delete global messages older than 24 hours"""
    try:
        db = SessionLocal()
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=24)
        
        # Count messages to delete
        count = db.query(models.GlobalMessage).filter(
            models.GlobalMessage.created_at < cutoff_time
        ).count()
        
        if count == 0:
            logger.info("✅ No global messages to delete")
            db.close()
            return
        
        # Delete old messages
        db.execute(
            delete(models.GlobalMessage).where(
                models.GlobalMessage.created_at < cutoff_time
            )
        )
        db.commit()
        
        logger.info(f"🗑️  Deleted {count} global messages older than 24 hours")
        logger.info(f"   Cutoff time: {cutoff_time.isoformat()}")
        
    except Exception as e:
        logger.error(f"❌ Error deleting old global messages: {e}")
        db.rollback()
    finally:
        db.close()


def start_cleanup_scheduler():
    """Start the daily cleanup scheduler"""
    if scheduler.running:
        return
    
    # Schedule cleanup to run daily at 00:00 UTC (midnight)
    scheduler.add_job(
        cleanup_old_global_messages,
        'cron',
        hour=0,
        minute=0,
        id='cleanup_global_messages',
        name='Daily Global Chat Cleanup',
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    
    scheduler.start()
    logger.info("✅ Global chat cleanup scheduler started")
    logger.info("   Scheduled for: Daily at 00:00 UTC")
    logger.info("   Cleanup duration: 24 hours")


def stop_cleanup_scheduler():
    """Stop the cleanup scheduler"""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("⏹️  Global chat cleanup scheduler stopped")
