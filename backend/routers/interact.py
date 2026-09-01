from datetime import datetime
from typing import cast

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app import models, schemas
from backend.app.database import get_db
from backend.app.oath2 import get_current_user


router = APIRouter(prefix="/interact", tags=["interaction"])


# Like endpoints
@router.post("/like/{blog_id}", response_model=schemas.LikeToggleResponse)
def toggle_like(
    blog_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    blog = db.query(models.Blog).filter(models.Blog.id == blog_id).first()
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")

    current_user_id = cast(int, current_user.id)
    existing_like = db.query(models.Like).filter(
        models.Like.blog_id == blog_id,
        models.Like.user_id == current_user_id,
    ).first()

    if existing_like:
        db.delete(existing_like)
        db.commit()
        liked = False
    else:
        new_like = models.Like(blog_id=blog_id, user_id=current_user_id)
        db.add(new_like)
        db.commit()
        liked = True

    likes_count = db.query(models.Like).filter(models.Like.blog_id == blog_id).count()
    return schemas.LikeToggleResponse(liked=liked, likes_count=likes_count)


@router.get("/like/{blog_id}/status", response_model=schemas.LikeToggleResponse)
def get_like_status(
    blog_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    blog = db.query(models.Blog).filter(models.Blog.id == blog_id).first()
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")

    current_user_id = cast(int, current_user.id)
    existing_like = db.query(models.Like).filter(
        models.Like.blog_id == blog_id,
        models.Like.user_id == current_user_id,
    ).first()

    likes_count = db.query(models.Like).filter(models.Like.blog_id == blog_id).count()
    return schemas.LikeToggleResponse(liked=bool(existing_like), likes_count=likes_count)


# Comment endpoints
@router.post("/comment", response_model=schemas.CommentResponse, status_code=status.HTTP_201_CREATED)
def create_comment(
    request: schemas.CommentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    blog = db.query(models.Blog).filter(models.Blog.id == request.blog_id).first()
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")

    if not request.content or not request.content.strip():
        raise HTTPException(status_code=400, detail="Comment content cannot be empty")

    current_user_id = cast(int, current_user.id)
    new_comment = models.Comment(  # type: ignore[call-arg]
        blog_id=request.blog_id,
        user_id=current_user_id,
        content=request.content.strip(),
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)

    user_name = current_user.name or "Anonymous"
    user_initial = user_name.strip()[0].upper() if user_name.strip() else "A"

    return schemas.CommentResponse(
        id=cast(int, new_comment.id),
        blog_id=cast(int, new_comment.blog_id),
        user_id=cast(int, new_comment.user_id),
        content=cast(str, new_comment.content),
        created_at=cast(datetime, new_comment.created_at),
        user_name=cast(str, user_name),
        user_initial=cast(str, user_initial),
    )


@router.get("/comments/{blog_id}", response_model=list[schemas.CommentResponse])
def get_comments(
    blog_id: int,
    db: Session = Depends(get_db)
):
    comments = db.query(models.Comment).filter(
        models.Comment.blog_id == blog_id
    ).order_by(models.Comment.created_at.desc()).all()
    
    result = []
    for comment in comments:
        user_name = comment.user.name if comment.user else "Anonymous"
        user_initial = user_name.strip()[0].upper() if user_name.strip() else "A"
        result.append(schemas.CommentResponse(
            id=cast(int, comment.id),
            blog_id=cast(int, comment.blog_id),
            user_id=cast(int, comment.user_id),
            content=cast(str, comment.content),
            created_at=cast(datetime, comment.created_at),
            user_name=cast(str, user_name),
            user_initial=cast(str, user_initial),
        ))
    
    return result


@router.put("/comment/{comment_id}", response_model=schemas.CommentResponse)
def update_comment(
    comment_id: int,
    request: schemas.CommentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    comment_user_id = cast(int, comment.user_id)
    current_user_id = cast(int, current_user.id)
    if comment_user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only edit your own comments")

    if not request.content or not request.content.strip():
        raise HTTPException(status_code=400, detail="Comment content cannot be empty")

    comment.content = request.content.strip()  # type: ignore[assignment]
    db.commit()
    db.refresh(comment)

    user_name = comment.user.name if comment.user else "Anonymous"
    user_initial = user_name.strip()[0].upper() if user_name.strip() else "A"

    return schemas.CommentResponse(
        id=cast(int, comment.id),
        blog_id=cast(int, comment.blog_id),
        user_id=cast(int, comment.user_id),
        content=cast(str, comment.content),
        created_at=cast(datetime, comment.created_at),
        user_name=cast(str, user_name),
        user_initial=cast(str, user_initial),
    )


@router.delete("/comment/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    blog = db.query(models.Blog).filter(models.Blog.id == comment.blog_id).first()
    if blog is None:
        raise HTTPException(status_code=404, detail="Blog not found")

    comment_user_id = cast(int, comment.user_id)
    current_user_id = cast(int, current_user.id)
    blog_user_id = cast(int, blog.user_id)
    if comment_user_id != current_user_id and blog_user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own comments or comments on your blogs")

    db.delete(comment)
    db.commit()
    return None