from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

DB_URL=os.getenv("DATABASE_URL")
engine=create_engine(DB_URL)


SessionLocal=sessionmaker(bind=engine,autocommit=False,autoflush=False)

base=declarative_base()


def get_db():
    db=SessionLocal()
    try:
        yield db
    finally:
        db.close()
