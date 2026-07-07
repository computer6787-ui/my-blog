from pydantic import BaseModel, ConfigDict
from typing import Optional



class Blog(BaseModel):
    title:str
    body:str
    published:Optional[bool]=True

    class Config():
        
     model_config = ConfigDict(from_attributes=True)



class User(BaseModel):
    name:str
    email:str
    password:str

class Show_user(BaseModel):
    name:str
    email:str
    blogs:list[Blog]=[]

    class Config():
        orm_mode=True



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