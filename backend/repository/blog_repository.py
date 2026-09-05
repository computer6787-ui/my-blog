from fastapi import Path, status, Response, HTTPException
from backend.app import models
from typing import List
from fastapi.responses import FileResponse
from sqlalchemy import desc, or_


CATEGORY_KEYWORDS = {
    "Tech": ["code", "programming", "software", "data", "server", "api", "python", "javascript", "app", "developer", "database", "tech", "digital", "computer"],
    "Life": ["life", "people", "family", "friend", "love", "health", "home", "travel", "journey", "nature", "peace", "memory", "experience"],
    "Creative": ["art", "creative", "music", "paint", "design", "visual", "poem", "story", "beautiful", "aesthetic", "color", "inspire"],
    "Ideas": ["idea", "thought", "concept", "vision", "future", "possibility", "innovation", "dream", "change", "better", "potential"],
    "Insights": ["insight", "learn", "knowledge", "wisdom", "understand", "discover", "lesson", "truth", "meaning", "purpose", "deep"],
    "Thoughts": ["think", "thought", "mind", "feel", "emotion", "wonder", "curious", "reflect", "ponder", "soul", "heart", "hope"],
    "Design": ["design", "ui", "ux", "interface", "layout", "visual", "user", "experience", "minimal", "modern", "product"],
    "Story": ["story", "journey", "adventure", "explore", "horizon", "chapter", "narrative", "memory", "moment", "experience"],
}


def infer_category(title: str | None, body: str | None) -> str | None:
    text = f"{title or ''} {body or ''}".lower()
    best_category = None
    best_score = 0

    for category, keywords in CATEGORY_KEYWORDS.items():
        score = sum(1 for keyword in keywords if keyword in text)
        if score > best_score:
            best_score = score
            best_category = category

    return best_category if best_score > 0 else "Creative"


def normalize_blog_category(request):
    raw_category = getattr(request, "category", None)
    if raw_category and raw_category.strip():
        return raw_category.strip()
    return infer_category(getattr(request, "title", None), getattr(request, "body", None))


def create_blog(request, db, current_user):
    new_blog = models.Blog(
        title=request.title,
        body=request.body,
        image_url=getattr(request, "image_url", None),
        category=normalize_blog_category(request),
        user_id=current_user.id,
    )
    db.add(new_blog)
    db.commit()
    db.refresh(new_blog)
    return new_blog


def matches_category(blog, category):
    if not category:
        return True

    normalized_category = category.strip()
    saved_category = (blog.category or "").strip()
    if saved_category and saved_category.lower() == normalized_category.lower():
        return True

    text = f"{blog.title or ''} {blog.body or ''}".lower()
    keywords = CATEGORY_KEYWORDS.get(normalized_category, [])
    return any(keyword in text for keyword in keywords)


def all_blog(limit: int, skip: int, db, q=None, category=None):
    from sqlalchemy import func
    from sqlalchemy.orm import joinedload

    base_query = db.query(models.Blog).filter(models.Blog.published == True)

    if q:
        base_query = base_query.filter(
            or_(
                models.Blog.title.ilike(f"%{q}%"),
                models.Blog.body.ilike(f"%{q}%"),
            )
        )

    # --- Category filtering requires keyword matching on title/body ---
    if category:
        all_blogs = (
            base_query
            .options(joinedload(models.Blog.creator))
            .order_by(desc(models.Blog.id))
            .all()
        )
        blogs = [b for b in all_blogs if matches_category(b, category)]
        total = len(blogs)
        blogs = blogs[skip:skip + limit]
        blog_ids = [b.id for b in blogs]
    else:
        total = base_query.count()
        if total == 0:
            return {"blogs": [], "total": 0}
        id_rows = (
            db.query(models.Blog.id)
            .filter(models.Blog.published == True)
        )
        if q:
            id_rows = id_rows.filter(
                or_(
                    models.Blog.title.ilike(f"%{q}%"),
                    models.Blog.body.ilike(f"%{q}%"),
                )
            )
        blog_ids = [r[0] for r in id_rows.order_by(desc(models.Blog.id)).offset(skip).limit(limit).all()]
        if not blog_ids:
            return {"blogs": [], "total": total}
        blogs = (
            db.query(models.Blog)
            .options(joinedload(models.Blog.creator))
            .filter(models.Blog.id.in_(blog_ids))
            .order_by(desc(models.Blog.id))
            .all()
        )

    # --- Bulk likes/comments counting (avoids N+1 per blog per page) ---
    if blog_ids:
        likes_counts = dict(
            db.query(models.Like.blog_id, func.count(models.Like.id))
            .filter(models.Like.blog_id.in_(blog_ids))
            .group_by(models.Like.blog_id)
            .all()
        )
        comments_counts = dict(
            db.query(models.Comment.blog_id, func.count(models.Comment.id))
            .filter(models.Comment.blog_id.in_(blog_ids))
            .group_by(models.Comment.blog_id)
            .all()
        )
        for blog in blogs:
            blog.likes_count = likes_counts.get(blog.id, 0)
            blog.comments_count = comments_counts.get(blog.id, 0)
            # The card grid does not use the heavy base64 image; omitting it
            # slashes the listing payload from many hundreds of KB per row to
            # ~1-2 KB. Full images are still served on the individual blog page.
            blog.image_url = None

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

    if not update_data.get("category") or not str(update_data.get("category")).strip():
        update_data["category"] = infer_category(update_data.get("title"), update_data.get("body"))

    db.query(models.Blog).filter(models.Blog.id == id).update(
        update_data, synchronize_session=False
    )
    db.commit()
    return "The content is updated."
