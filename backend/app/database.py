import os
import time

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set")

# Abort any single statement after N seconds so a slow/stalled remote query
# releases its pool slot instead of silently pinning it for minutes. Set to 0
# or "" to disable per-statement timeouts.
STATEMENT_TIMEOUT = os.getenv("DATABASE_STATEMENT_TIMEOUT", "15000")

_connect_args: dict = {"connect_timeout": 10}
if STATEMENT_TIMEOUT and STATEMENT_TIMEOUT.strip() != "0":
    _connect_args["options"] = f"-c statement_timeout={STATEMENT_TIMEOUT.strip()}"

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,        # detect stale/pooled-away connections on checkout
    pool_size=5,                # base connections kept open per process
    max_overflow=5,             # allow bursts up to 10 per process
    pool_recycle=1800,          # recycle after 30 min (pre_ping handles staleness)
    pool_timeout=30,            # wait up to 30s for a slot before failing
    connect_args=_connect_args,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

base = declarative_base()

# Opt-in pool diagnostics (off by default): set POOL_DEBUG=1 to log a [db-pool]
# line whenever a request holds a session open longer than POOL_DEBUG_SLOW_MS,
# with the live pool status (checkedin/checkedout/overflow). No production noise
# unless explicitly enabled.
POOL_DEBUG = os.getenv("POOL_DEBUG", "").strip().lower() in {"1", "true", "yes"}
POOL_DEBUG_SLOW_MS = int(os.getenv("POOL_DEBUG_SLOW_MS", "1500"))


def get_db():
    db = SessionLocal()
    if POOL_DEBUG:
        start = time.perf_counter()
        try:
            yield db
        finally:
            elapsed_ms = (time.perf_counter() - start) * 1000
            if elapsed_ms > POOL_DEBUG_SLOW_MS:
                print(
                    f"[db-pool] session held {elapsed_ms:.0f}ms | "
                    f"pool={engine.pool.status()}"
                )
            db.close()
    else:
        try:
            yield db
        finally:
            db.close()