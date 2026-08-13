from datetime import datetime

from pydantic import BaseModel, ConfigDict
from typing import Optional



class Blog(BaseModel):
    title:str
    body:str
    published:Optional[bool]=True

    class Config():
        
     model_config = ConfigDict(from_attributes=True)

class BlogSummary(BaseModel):
    id: int
    title: str
    body: str
    published: bool

    class Config:
        orm_mode = True



class User(BaseModel):
    name:str
    email:str
    password:str

class Show_user(BaseModel):
    name:str
    email:str
    blogs:list[BlogSummary]=[]

    class Config():
        orm_mode=True

class PendingUser(BaseModel):
    name: str
    email: str
    hashed_password: str
    verification_code: str
    expires_at: datetime

    class Config:
        orm_mode = True



class ShowBlog(BaseModel):
    id:int
    title:str
    body:str
    creator:Show_user

    class Config():
        orm_mode=True

class Login(BaseModel):
    username:str
    password:str


class Token(BaseModel):
    access_token:str
    token_type:str

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