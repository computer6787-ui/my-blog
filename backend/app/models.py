from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from .database import base
from datetime import datetime, timezone


def utcnow():
    return datetime.now(timezone.utc)


class Blog(base):
    __tablename__="blogs"
    id=Column(Integer, primary_key=True, index=True)
    title=Column(String)
    body=Column(String)
    image_url=Column(String, nullable=True)
    category=Column(String, nullable=True)
    published=Column(Boolean, default=True)
    created_at=Column(DateTime(timezone=True), default=utcnow)
    user_id=Column(Integer,ForeignKey("users.id"))

    creator=relationship("User",back_populates="blogs")
    likes=relationship("Like", back_populates="blog", cascade="all, delete-orphan")
    comments=relationship("Comment", back_populates="blog", cascade="all, delete-orphan")


class Like(base):
    __tablename__="likes"
    id=Column(Integer, primary_key=True, index=True)
    blog_id=Column(Integer, ForeignKey("blogs.id", ondelete="CASCADE"))
    user_id=Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    created_at=Column(DateTime(timezone=True), default=utcnow)
    
    blog=relationship("Blog", back_populates="likes")
    user=relationship("User")


class Comment(base):
    __tablename__="comments"
    id=Column(Integer, primary_key=True, index=True)
    blog_id=Column(Integer, ForeignKey("blogs.id", ondelete="CASCADE"))
    user_id=Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    parent_id=Column(Integer, nullable=True, default=None)
    content=Column(String)
    created_at=Column(DateTime(timezone=True), default=utcnow)
    
    blog=relationship("Blog", back_populates="comments")
    user=relationship("User")
    mentions=relationship("Mention", back_populates="comment", cascade="all, delete-orphan")


class Mention(base):
    __tablename__="mentions"
    id=Column(Integer, primary_key=True, index=True)
    comment_id=Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"))
    mentioned_user_id=Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    created_at=Column(DateTime(timezone=True), default=utcnow)

    comment=relationship("Comment", back_populates="mentions")
    mentioned_user=relationship("User", foreign_keys=[mentioned_user_id])


class Notification(base):
    __tablename__="notifications"
    id=Column(Integer, primary_key=True, index=True)
    user_id=Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    type=Column(String)  # 'mention', 'like', 'comment'
    reference_type=Column(String)  # 'blog', 'comment'
    reference_id=Column(Integer)
    actor_name=Column(String, nullable=True)
    is_read=Column(Boolean, default=False)
    created_at=Column(DateTime(timezone=True), default=utcnow)

    user=relationship("User", foreign_keys=[user_id])


class User(base):
    __tablename__="users"
    id=Column(Integer, primary_key=True, index=True)
    name=Column(String)
    email=Column(String)
    hashed_password=Column(String)
    profile_picture_url=Column(String, nullable=True)
    bio=Column(String, nullable=True)
    location=Column(String, nullable=True)
    hobby=Column(String, nullable=True)
    occupation=Column(String, nullable=True)
    education=Column(String, nullable=True)
    facebook=Column(String, nullable=True)
    instagram=Column(String, nullable=True)

    blogs=relationship("Blog",back_populates="creator")
    likes=relationship("Like", back_populates="user")
    comments=relationship("Comment", back_populates="user")
    mentions_received=relationship("Mention", foreign_keys=[Mention.mentioned_user_id], back_populates="mentioned_user")
    notifications=relationship("Notification", back_populates="user")


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

class passward_varification(base):
    __tablename__="passward_varification"
    id = Column(Integer, primary_key=True, index=True)
    email=Column(String, unique=True, nullable=False)
    verification_code = Column(String, nullable=False)
    verified = Column(Boolean, default=False)
    expires_at = Column(
        DateTime(timezone=True)
    )

