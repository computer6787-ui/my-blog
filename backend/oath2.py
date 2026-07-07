from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer

from backend import models
from . import token
from .database import get_db







oath2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def get_current_user(data: str=Depends(oath2_scheme), db=Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
   

    username = token.verify_token(data, credentials_exception)

    user = db.query(models.User).filter(models.User.email == username).first()


    if not user:
        raise credentials_exception

    return user

    