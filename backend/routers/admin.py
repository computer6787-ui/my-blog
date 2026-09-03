from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from ..app import models
from ..app.database import get_db
from ..app.oath2 import get_current_user
from ..app.config import MAIN_ADMIN_EMAIL

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
)


def is_owner(user: models.User) -> bool:
    """Returns True if this user is the main site owner (defined in config).
    The owner account has absolute power and cannot be removed, demoted,
    or deactivated by any admin action."""
    return str(user.email).lower() == MAIN_ADMIN_EMAIL.lower()


def require_admin(current_user: models.User = Depends(get_current_user)) -> models.User:
    if current_user.role != "admin":  # type: ignore
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


def require_staff(current_user: models.User = Depends(get_current_user)) -> models.User:
    if current_user.role not in ("admin", "moderator"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff access required",
        )
    return current_user


def _user_summary(user):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role or "user",
        "is_active": bool(user.is_active),
        "is_owner": is_owner(user),
        "profile_picture_url": user.profile_picture_url,
        "blogs_count": (user.blogs or []).__len__(),
    }


# ---- Dashboard stats ----
@router.get("/stats")
def dashboard_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff),
):
    users_count = db.query(models.User).count()
    blogs_count = db.query(models.Blog).count()
    comments_count = db.query(models.Comment).count()
    likes_count = db.query(models.Like).count()
    published_count = db.query(models.Blog).filter(models.Blog.published == True).count()
    moderators_count = db.query(models.User).filter(models.User.role == "moderator").count()

    recent_blogs = db.query(models.Blog).order_by(desc(models.Blog.id)).limit(5).all()
    recent = []
    for blog in recent_blogs:
        recent.append({
            "id": blog.id,
            "title": blog.title,
            "category": blog.category,
            "published": bool(blog.published),
            "created_at": blog.created_at,
            "author": blog.creator.name if blog.creator else "Unknown",
        })

    top_authors_raw = db.query(
        models.User.id,
        models.User.name,
        models.User.profile_picture_url,
        func.count(models.Blog.id).label("blog_count"),
    ).join(models.Blog, models.Blog.user_id == models.User.id).group_by(models.User.id).order_by(desc("blog_count")).limit(5).all()

    top_authors = [
        {
            "id": a.id,
            "name": a.name,
            "profile_picture_url": a.profile_picture_url,
            "blog_count": a.blog_count,
        }
        for a in top_authors_raw
    ]

    return {
        "users_count": users_count,
        "blogs_count": blogs_count,
        "comments_count": comments_count,
        "likes_count": likes_count,
        "published_count": published_count,
        "moderators_count": moderators_count,
        "recent_blogs": recent,
        "top_authors": top_authors,
    }


# ---- User management ----
@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff),
    q: str | None = None,
    role: str | None = None,
):
    query = db.query(models.User)
    if q:
        query = query.filter(
            (models.User.name.ilike(f"%{q}%")) |
            (models.User.email.ilike(f"%{q}%"))
        )
    if role:
        query = query.filter(models.User.role == role)

    users = query.order_by(models.User.id).all()
    return [_user_summary(u) for u in users]


@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    request: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    new_role = request.get("role")
    new_active = request.get("is_active")

    # ---- Owner protection: the owner account defined in config can NEVER
    # be demoted, deactivated, or deleted by anyone ----
    if is_owner(target):
        if new_role is not None and new_role != "admin":
            raise HTTPException(
                status_code=400,
                detail="The site owner account cannot have its role changed.",
            )
        if new_active is not None and new_active is False:
            raise HTTPException(
                status_code=400,
                detail="The site owner account cannot be deactivated.",
            )
        # Nothing else can change for the owner; return current state
        db.commit()
        db.refresh(target)
        return _user_summary(target)

    # ---- Only the owner can manage OTHER admin accounts.
    # Regular admins can manage users and moderators, but not other admins ----
    if target.role == "admin" and not is_owner(current_user):  # type: ignore
        raise HTTPException(
            status_code=403,
            detail="Only the site owner can manage admin accounts.",
        )

    if new_role is not None:
        if new_role not in ("user", "moderator", "admin"):
            raise HTTPException(status_code=400, detail="Invalid role")
        if target.role == "admin" and new_role != "admin":  # type: ignore
            admin_count = db.query(models.User).filter(
                models.User.role == "admin"
            ).count()
            if admin_count <= 1:
                raise HTTPException(status_code=400, detail="Cannot remove the last admin")
        target.role = new_role  # type: ignore

    if new_active is not None:
        if target.role == "admin" and new_active is False:  # type: ignore
            admin_count = db.query(models.User).filter(
                models.User.role == "admin"
            ).count()
            if admin_count <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot deactivate the last admin",
                )
        target.is_active = bool(new_active)  # type: ignore

    db.commit()
    db.refresh(target)
    return _user_summary(target)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # ---- Owner protection: the owner account can NEVER be deleted ----
    if is_owner(target):
        raise HTTPException(
            status_code=400,
            detail="The site owner account cannot be deleted.",
        )

    # ---- Only the owner can delete OTHER admin accounts ----
    if target.role == "admin" and not is_owner(current_user):  # type: ignore
        raise HTTPException(
            status_code=403,
            detail="Only the site owner can remove admin accounts.",
        )

    if target.role == "admin":  # type: ignore
        admin_count = db.query(models.User).filter(
            models.User.role == "admin"
        ).count()
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last admin")

    if target.id == current_user.id:  # type: ignore
        raise HTTPException(
            status_code=400,
            detail="You cannot delete your own account",
        )

    db.delete(target)
    db.commit()
    return None


# ---- Blog moderation ----
@router.get("/blogs")
def list_blogs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff),
    q: str | None = None,
    published: bool | None = None,
):
    query = db.query(models.Blog)
    if q:
        query = query.filter(
            (models.Blog.title.ilike(f"%{q}%")) |
            (models.Blog.body.ilike(f"%{q}%"))
        )
    if published is not None:
        query = query.filter(models.Blog.published == published)

    blogs = query.order_by(desc(models.Blog.id)).all()
    result = []
    for blog in blogs:
        result.append({
            "id": blog.id,
            "title": blog.title,
            "category": blog.category,
            "published": bool(blog.published),
            "created_at": blog.created_at,
            "image_url": blog.image_url,
            "author": blog.creator.name if blog.creator else "Unknown",
            "author_id": blog.user_id,
            "likes_count": db.query(models.Like).filter(
                models.Like.blog_id == blog.id
            ).count(),
            "comments_count": db.query(models.Comment).filter(
                models.Comment.blog_id == blog.id
            ).count(),
        })
    return result


@router.put("/blogs/{blog_id}/publish")
def toggle_blog_publish(
    blog_id: int,
    request: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff),
):
    blog = db.query(models.Blog).filter(models.Blog.id == blog_id).first()
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")
    blog.published = bool(request.get("published", not blog.published))  # type: ignore
    db.commit()
    db.refresh(blog)
    return {"id": blog.id, "published": bool(blog.published)}


@router.delete("/blogs/{blog_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_blog(
    blog_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff),
):
    blog = db.query(models.Blog).filter(models.Blog.id == blog_id).first()
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")
    db.delete(blog)
    db.commit()
    return None


# ---- Comment moderation ----
@router.get("/comments")
def list_comments(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff),
):
    comments = db.query(models.Comment).order_by(
        desc(models.Comment.id)
    ).limit(200).all()
    result = []
    for comment in comments:
        result.append({
            "id": comment.id,
            "content": comment.content,
            "created_at": comment.created_at,
            "user_name": comment.user.name if comment.user else "Unknown",
            "blog_id": comment.blog_id,
            "blog_title": comment.blog.title if comment.blog else "Deleted blog",
        })
    return result


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff),
):
    comment = db.query(models.Comment).filter(
        models.Comment.id == comment_id
    ).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    db.delete(comment)
    db.commit()
    return None

