from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,        # detect stale/pooled-away connections
    pool_size=4,                # base connections kept open
    max_overflow=4,             # allow brief bursts up to 8 total
    pool_recycle=300,           # recycle after 5 min (Supabase idle timeout ~5 min)
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()