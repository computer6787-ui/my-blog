from datetime import datetime
from pydantic import BaseModel, ConfigDict
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


class Show_user(BaseModel):
    id: int
    name: str
    email: str
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


class CommentUpdate(BaseModel):
    content: str


class CommentResponse(BaseModel):
    id: int
    blog_id: int
    user_id: int
    content: str
    created_at: datetime
    user_name: str
    user_initial: str

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
