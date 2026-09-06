from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import func

from backend.app import models
from . import token
from .database import get_db







oath2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def get_current_user(data: str = Depends(oath2_scheme), db = Depends(get_db)) -> models.User:
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    username = token.verify_token(data, credentials_exception)

    users = db.query(models.User).filter(models.User.email == username).all()
    if not users:
        raise credentials_exception

    # Pick the account with the most blogs (existing behavior for duplicate
    # emails), but count blogs with a single grouped query instead of
    # lazy-loading every Blog row (including full bodies) — which previously
    # ran on every authenticated request and held a pool connection longer
    # while shipping unused blog content.
    blog_counts = dict(
        db.query(models.Blog.user_id, func.count(models.Blog.id))
        .filter(models.Blog.user_id.in_([u.id for u in users]))
        .group_by(models.Blog.user_id)
        .all()
    )

    def user_priority(user: models.User):
        return (blog_counts.get(user.id, 0), user.id)

    return max(users, key=user_priority)

    