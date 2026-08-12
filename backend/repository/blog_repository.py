from fastapi import Path, status,Response,HTTPException
from backend.app import models
from typing import List
from fastapi.responses import FileResponse
from sqlalchemy import desc,or_




def create_blog(request,db,current_user):
    new_blog=models.Blog(title=request.title,body=request.body,user_id=current_user.id)
    db.add(new_blog)
    db.commit()
    db.refresh(new_blog)
    return new_blog

def all_blog(limit: int, skip: int, db, q=None):
    query = db.query(models.Blog)

    if q:
        query = query.filter(
            or_(
                models.Blog.title.ilike(f"%{q}%"),
                models.Blog.body.ilike(f"%{q}%")
            )
        )

    blogs = (query.order_by(desc(models.Blog.id)).offset(skip).limit(limit).all())

    return blogs

def destroy(id:int,db):
    blog=db.query(models.Blog).filter(models.Blog.id==id).delete(synchronize_session=False)
    db.commit()
    if not blog:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail=f"Blog with the id {id} is not available")
    return "The content has been deleted successfully"


def get_blog(id:int,db):
    blogs=db.query(models.Blog).filter(models.Blog.id==id).first()
    if not blogs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail=f"Blog with the id {id} is not available")
    return blogs

def update(id:int,request,db):
    blog=db.query(models.Blog).filter(models.Blog.id==id).update(request.model_dump(),synchronize_session=False)
    db.commit()
    if not blog:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail=f"Blog with the id {id} is not available")
    return "The content is updated."