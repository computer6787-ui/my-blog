from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional


class Blog(BaseModel):
    title: str
    body: str
    image_url: Optional[str] = None
    category: Optional[str] = None
    published: Optional[bool] = True

    class Config:
        from_attributes = True
        orm_mode = True


class BlogSummary(BaseModel):
    id: int
    title: str
    body: str
    image_url: Optional[str] = None
    category: Optional[str] = None
    published: bool
    created_at: Optional[datetime] = None
    likes_count: int = 0
    comments_count: int = 0

    class Config:
        from_attributes = True
        orm_mode = True


class User(BaseModel):
    name: str
    email: str
    password: str


class edit_user(BaseModel):
    name: str


class UserProfileEdit(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    profile_picture_url: Optional[str] = None
    location: Optional[str] = None
    hobby: Optional[str] = None
    occupation: Optional[str] = None
    education: Optional[str] = None
    facebook: Optional[str] = None
    instagram: Optional[str] = None


class Show_user(BaseModel):
    id: int
    name: str
    email: str
    profile_picture_url: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    hobby: Optional[str] = None
    occupation: Optional[str] = None
    education: Optional[str] = None
    facebook: Optional[str] = None
    instagram: Optional[str] = None
    blogs: list[BlogSummary] = []

    class Config:
        from_attributes = True
        orm_mode = True


class PendingUser(BaseModel):
    name: str
    email: str
    hashed_password: str
    verification_code: str
    expires_at: datetime

    class Config:
        from_attributes = True
        orm_mode = True


class ShowBlog(BaseModel):
    id: int
    title: str
    body: str
    image_url: Optional[str] = None
    category: Optional[str] = None
    created_at: Optional[datetime] = None
    creator: Show_user
    likes_count: int = 0
    comments_count: int = 0

    class Config:
        from_attributes = True
        orm_mode = True


class Login(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class VerifyUser(BaseModel):
    email: str
    verification_code: str


class BlogResponse(BaseModel):
    blogs: list[ShowBlog]
    total: int

    class Config:
        from_attributes = True
        orm_mode = True


class verify_email(BaseModel):
    email: str


class Update_password(BaseModel):
    email: str
    new_password: str


# Like schemas
class LikeCreate(BaseModel):
    blog_id: int


class LikeResponse(BaseModel):
    id: int
    blog_id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True
        orm_mode = True


class LikeToggleResponse(BaseModel):
    liked: bool
    likes_count: int


# Comment schemas
class CommentCreate(BaseModel):
    blog_id: int
    content: str
    parent_id: Optional[int] = None
    mentions: Optional[list[str]] = Field(default_factory=list)

    class Config:
        from_attributes = True
        orm_mode = True


class CommentUpdate(BaseModel):
    content: str


class CommentResponse(BaseModel):
    id: int
    blog_id: int
    user_id: int
    parent_id: Optional[int] = None
    content: str
    created_at: datetime
    user_name: str
    user_initial: str
    user_profile_picture_url: Optional[str] = None
    mentions: Optional[list[dict]] = None
    replies: Optional[list["CommentResponse"]] = Field(default_factory=list)

    class Config:
        from_attributes = True
        orm_mode = True


class BlogDetailResponse(BaseModel):
    id: int
    title: str
    body: str
    image_url: Optional[str] = None
    category: Optional[str] = None
    created_at: Optional[datetime] = None
    creator: Show_user
    likes_count: int = 0
    comments_count: int = 0
    user_has_liked: bool = False

    class Config:
        from_attributes = True
        orm_mode = True


# Mention schemas
class MentionResponse(BaseModel):
    id: int
    comment_id: int
    mentioned_user_id: int
    mentioned_user_name: str
    created_at: datetime

    class Config:
        from_attributes = True
        orm_mode = True


# Notification schemas
class NotificationResponse(BaseModel):
    id: int
    user_id: int
    type: str
    reference_type: str
    reference_id: int
    is_read: bool
    created_at: datetime
    message: Optional[str] = None
    actor_name: Optional[str] = None
    actor_profile_picture_url: Optional[str] = None
    blog_id: Optional[int] = None
    comment_id: Optional[int] = None

    class Config:
        from_attributes = True
        orm_mode = True

    @classmethod
    def build_message(cls, notification_type: str, actor_name: Optional[str] = None) -> str:
        who = actor_name or "Someone"
        type_map = {
            "mention": f"{who} mentioned you in a comment",
            "like": f"{who} liked your blog",
            "comment": f"{who} commented on your blog",
            "reply": f"{who} replied to your comment",
        }
        return type_map.get(notification_type, f"{who} interacted with your content")


class MarkNotificationRead(BaseModel):
    notification_id: int
