from fastapi import Path, status, Response, HTTPException
from backend.app import models
from typing import List
from fastapi.responses import FileResponse
from sqlalchemy import desc, or_


def create_blog(request, db, current_user):
    new_blog = models.Blog(
        title=request.title,
        body=request.body,
        image_url=getattr(request, "image_url", None),
        category=getattr(request, "category", None),
        user_id=current_user.id,
    )
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
                models.Blog.body.ilike(f"%{q}%"),
            )
        )
    total = query.count()
    blogs = query.order_by(desc(models.Blog.id)).offset(skip).limit(limit).all()

    for blog in blogs:
        blog.likes_count = db.query(models.Like).filter(models.Like.blog_id == blog.id).count()
        blog.comments_count = db.query(models.Comment).filter(models.Comment.blog_id == blog.id).count()

    return {
        "blogs": blogs,
        "total": total,
    }


def destroy(id: int, db, current_user):
    blog = db.query(models.Blog).filter(models.Blog.id == id).first()
    if not blog:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Blog with the id {id} is not available",
        )
    if blog.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cant delete this blog",
        )
    db.query(models.Blog).filter(models.Blog.id == id).delete(synchronize_session=False)
    db.commit()
    return "The content has been deleted successfully"


def get_blog(id: int, db):
    blog = db.query(models.Blog).filter(models.Blog.id == id).first()
    if not blog:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Blog with the id {id} is not available",
        )
    blog.likes_count = db.query(models.Like).filter(models.Like.blog_id == blog.id).count()
    blog.comments_count = db.query(models.Comment).filter(models.Comment.blog_id == blog.id).count()
    return blog


def update(id: int, request, db, current_user):
    blog = db.query(models.Blog).filter(models.Blog.id == id).first()
    if not blog:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Blog with the id {id} is not available",
        )
    if blog.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cant update this blog",
        )
    update_data = (
        request.model_dump()
        if hasattr(request, "model_dump")
        else request.dict()
    )
    db.query(models.Blog).filter(models.Blog.id == id).update(
        update_data, synchronize_session=False
    )
    db.commit()
    return "The content is updated."
