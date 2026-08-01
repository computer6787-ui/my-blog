from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from .database import base
from datetime import datetime



class Blog(base):
    __tablename__="blogs"
    id=Column(Integer, primary_key=True, index=True)
    title=Column(String)
    body=Column(String)
    published=Column(Boolean, default=True)
    user_id=Column(Integer,ForeignKey("users.id"))

    creator=relationship("User",back_populates="blogs")

class User(base):
    __tablename__="users"
    id=Column(Integer, primary_key=True, index=True)
    name=Column(String)
    email=Column(String)
    hashed_password=Column(String)

    blogs=relationship("Blog",back_populates="creator")



class PendingUser(base):
    __tablename__ = "pending_users"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String, nullable=False)

    email = Column(String, unique=True, nullable=False)

    hashed_password = Column(String, nullable=False)

    verification_code = Column(String, nullable=False)

    expires_at = Column(
        DateTime(timezone=True)
    )