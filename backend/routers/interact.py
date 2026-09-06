from datetime import datetime, timedelta, timezone
from typing import Any, Optional, cast
import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from backend.app import models, schemas
from backend.app.database import get_db
from backend.app.oath2 import get_current_user


router = APIRouter(prefix="/interact", tags=["interaction"])

# Notification retention: any notification younger than 3 days is always kept.
# Older notifications are capped to the 15 most recent per user to save space.
NOTIFICATION_RETENTION_DAYS = 3
MAX_KEPT_OLD_NOTIFICATIONS = 15


def _prune_notifications(db: Session, user_id: int) -> None:
    cutoff: datetime = datetime.now(timezone.utc) - timedelta(days=NOTIFICATION_RETENTION_DAYS)
    old_rows = db.query(models.Notification.id).filter(
        models.Notification.user_id == user_id,
        models.Notification.created_at < cutoff
    ).order_by(models.Notification.created_at.desc()).all()

    if len(old_rows) <= MAX_KEPT_OLD_NOTIFICATIONS:
        return
    delete_ids = [cast(int, row[0]) for row in old_rows[MAX_KEPT_OLD_NOTIFICATIONS:]]
    db.query(models.Notification).filter(
        models.Notification.id.in_(delete_ids)
    ).delete(synchronize_session=False)
    db.commit()


def prune_all_notifications() -> None:
    """Startup sweep: apply the retention rule to every user once when the app boots."""
    try:
        from backend.app.database import SessionLocal
        db = SessionLocal()
        try:
            user_ids = [
                cast(int, row[0])
                for row in db.query(models.Notification.user_id).distinct().all()
            ]
            for user_id in user_ids:
                _prune_notifications(db, user_id)
        finally:
            db.close()
    except Exception as e:
        print("Notification retention notice:", e)


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
        # Notify blog author about the like (unless self-like)
        if cast(int, blog.user_id) != current_user_id:
            _notify_blog_author(db, blog_id, current_user_id, cast(str, current_user.name), "like")

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


# Helper: create notifications for a blog author
def _notify_blog_author(db, blog_id: int, actor_id: int, actor_name: str, notif_type: str):
    blog = db.query(models.Blog).filter(models.Blog.id == blog_id).first()
    if not blog or blog.user_id == actor_id:
        return
    notification = models.Notification(
        user_id=blog.user_id,
        type=notif_type,
        reference_type="blog",
        reference_id=blog_id,
        actor_name=actor_name,
        is_read=False,
    )
    db.add(notification)
    db.commit()
    _prune_notifications(db, cast(int, blog.user_id))


def _resolve_mention_users(db: Session, raw_usernames: list[str]) -> dict[str, "models.User"]:
    """Batch-resolve @mention strings to Users with at most 2 queries.

    Treats the raw string as untrusted data. Uses an exact name match first
    (covers single- and multi-word names like "John Doe") for every mention
    in one ``IN`` query. Unmatched mentions then walk backward through word
    prefixes so a greedy extraction result such as "John Doe and" can still
    resolve to the real user "John Doe" — all candidate prefixes fetched in a
    single second query, so there is no per-mention round-trip.
    """
    unique = list(dict.fromkeys(name.strip() for name in raw_usernames))
    unique = [name for name in unique if name]
    if not unique:
        return {}

    users = db.query(models.User).filter(models.User.name.in_(unique)).all()
    by_name = {cast(str, u.name): u for u in users}

    unmatched = [name for name in unique if name not in by_name]
    if not unmatched:
        return by_name

    # Collect every prefix candidate across all unmatched mentions, fetch once.
    candidate_names = {
        candidate
        for name in unmatched
        for i in range(len(name.split(" ")) - 1, 0, -1)
        for candidate in [" ".join(name.split(" ")[:i])]
    }
    pending = [c for c in candidate_names if c and c not in by_name and c.strip()]
    if pending:
        extras = db.query(models.User).filter(models.User.name.in_(pending)).all()
        for u in extras:
            by_name.setdefault(cast(str, u.name), u)

    # Walk each unmatched mention's own prefix sequence in its original order.
    for name in unmatched:
        words = name.split(" ")
        for i in range(len(words) - 1, 0, -1):
            candidate = " ".join(words[:i]).strip()
            if not candidate:
                continue
            user = by_name.get(candidate)
            if user is not None:
                by_name[name] = user
                break
    return by_name




def _notify_mentioned_users(db, resolved_users: dict[str, "models.User"], comment_id: int, actor_name: str):
    """Create Mention + Notification rows for already-resolved mentioned users.

    ``resolved_users`` is the output of ``_resolve_mention_users`` keyed by
    @mention string. Users are deduped by id so two spellings that resolve to
    the same person ("John" and "John Doe") do not produce duplicate rows.
    """
    affected_user_ids: list[int] = []
    seen_ids: set[int] = set()
    for mentioned_user in resolved_users.values():
        uid = cast(int, mentioned_user.id) if mentioned_user.id is not None else None
        if uid is None or uid in seen_ids:
            continue
        seen_ids.add(uid)
        mention = models.Mention(
            comment_id=comment_id,
            mentioned_user_id=uid,
        )
        db.add(mention)
        notification = models.Notification(
            user_id=uid,
            type="mention",
            reference_type="comment",
            reference_id=comment_id,
            actor_name=actor_name,
            is_read=False,
        )
        db.add(notification)
        affected_user_ids.append(uid)
    db.commit()
    for user_id in affected_user_ids:
        _prune_notifications(db, user_id)


def _profile_picture_or_none(picture_url) -> Optional[str]:
    """Normalize a raw profile_picture_url column into a clean URL string or None.

    SQL NULL and empty strings both mean "no picture", so the API sends either a
    real URL or null for the frontend to render. The value is cast first because
    Pylance types SQLAlchemy column attributes as Column[str], whose __bool__ is
    NoReturn and therefore cannot be used directly in a conditional.
    """
    raw = cast(Optional[str], picture_url)
    return raw if raw else None


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
    new_comment = models.Comment(
        blog_id=request.blog_id,
        user_id=current_user_id,
        parent_id=request.parent_id,
        content=request.content.strip(),
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)

    # Handle mentions: extract @username from content. The pattern supports
    # multi-word names ("John Doe", "Ann Marie") by continuing through each
    # capitalized word, while stopping at punctuation, newlines, lowercase
    # prose words ("Ann Marie and Frank" -> "Ann Marie"), or the end.
    mentioned_usernames = [
        name
        for name in re.findall(
            r'@([\w]+(?: [A-Z][\w]*)*)',
            cast(str, new_comment.content),
        )
        if name.strip()
    ]

    # Create mention records and notifications. Resolve every mention in a
    # single batched query and reuse the result for the response below —
    # previously each mention triggered its own user lookup(s).
    resolved_mentions: dict[str, "models.User"] = {}
    if mentioned_usernames:
        resolved_mentions = _resolve_mention_users(db, mentioned_usernames)
        _notify_mentioned_users(db, resolved_mentions, cast(int, new_comment.id), cast(str, current_user.name))

    # If replying, notify the parent comment author as well. A reply gets its own
    # distinct notification type ("reply") so the UI can word it as "replied to
    # your comment" instead of being lumped in with plain top-level comments
    # (which are the "comment" type).
    reply_target_user_id: Optional[int] = None
    if request.parent_id:
        parent_comment = db.query(models.Comment).filter(models.Comment.id == request.parent_id).first()
        if parent_comment and cast(int, parent_comment.user_id) != current_user_id:
            reply_target_user_id = cast(int, parent_comment.user_id)
            reply_notification = models.Notification(
                user_id=reply_target_user_id,
                type="reply",
                reference_type="comment",
                reference_id=new_comment.id,
                actor_name=current_user.name,
                is_read=False,
            )
            db.add(reply_notification)
            db.commit()
            _prune_notifications(db, reply_target_user_id)

    # Notify blog author about new comment (unless self-comment, self-mention, or
    # the blog author already received the "reply" notification above for this
    # exact comment - no point firing a second generic one).
    if (
        cast(int, blog.user_id) != current_user_id
        and not mentioned_usernames
        and cast(int, blog.user_id) != reply_target_user_id
    ):
        _notify_blog_author(db, cast(int, blog.id), current_user_id, cast(str, current_user.name), "comment")

    user_name = current_user.name or "Anonymous"
    user_initial = user_name.strip()[0].upper() if user_name.strip() else "A"
    user_profile_picture_url = _profile_picture_or_none(current_user.profile_picture_url)

    # Build mentions list for response from already-resolved map
    mentions_response = []
    for raw_username in mentioned_usernames:
        mentioned_user = resolved_mentions.get(raw_username)
        if mentioned_user:
            # Mention row was created by _notify_mentioned_users
            mention = db.query(models.Mention).filter(
                models.Mention.comment_id == new_comment.id,
                models.Mention.mentioned_user_id == cast(int, mentioned_user.id)
            ).first()
            if mention:
                mentions_response.append({
                    "id": mention.id,
                    "comment_id": mention.comment_id,
                    "mentioned_user_id": mention.mentioned_user_id,
                    "mentioned_user_name": cast(str, mentioned_user.name),
                    "created_at": mention.created_at
                })

    return schemas.CommentResponse(
        id=cast(int, new_comment.id),
        blog_id=cast(int, new_comment.blog_id),
        user_id=cast(int, new_comment.user_id),
        parent_id=cast(int, new_comment.parent_id) if new_comment.parent_id is not None else None,
        content=cast(str, new_comment.content),
        created_at=cast(datetime, new_comment.created_at),
        user_name=cast(str, user_name),
        user_initial=cast(str, user_initial),
        user_profile_picture_url=user_profile_picture_url,
        mentions=mentions_response if mentions_response else None,
    )


@router.get("/comments/{blog_id}", response_model=list[schemas.CommentResponse])
def get_comments(
    blog_id: int,
    db: Session = Depends(get_db)
):
    comments = (
        db.query(models.Comment)
        .options(
            joinedload(models.Comment.user),
            joinedload(models.Comment.mentions).joinedload(models.Mention.mentioned_user),
        )
        .filter(models.Comment.blog_id == blog_id)
        .order_by(models.Comment.created_at.asc())
        .all()
    )

    def build_comment_response(comment: models.Comment) -> schemas.CommentResponse:
        user_name = comment.user.name if comment.user else "Anonymous"
        user_initial = user_name.strip()[0].upper() if user_name.strip() else "A"
        user_profile_picture_url = _profile_picture_or_none(
            comment.user.profile_picture_url if comment.user else None
        )

        mentions_response = []
        for mention in comment.mentions:
            if mention.mentioned_user and mention.mentioned_user.name:
                mentions_response.append({
                    "id": mention.id,
                    "comment_id": mention.comment_id,
                    "mentioned_user_id": mention.mentioned_user.id,
                    "mentioned_user_name": mention.mentioned_user.name,
                    "created_at": mention.created_at
                })

        # user_id should always exist (FK NOT NULL), but guard against data
        # anomalies where the user was deleted without cascade — use the FK
        # value if present, else a sentinel so the response still renders.
        safe_user_id = cast(int, comment.user_id) if comment.user_id is not None else 0

        return schemas.CommentResponse(
            id=cast(int, comment.id),
            blog_id=cast(int, comment.blog_id),
            user_id=safe_user_id,
            parent_id=cast(int, comment.parent_id) if comment.parent_id is not None else None,
            content=cast(str, comment.content),
            created_at=cast(datetime, comment.created_at),
            user_name=cast(str, user_name),
            user_initial=cast(str, user_initial),
            user_profile_picture_url=user_profile_picture_url,
            mentions=mentions_response if mentions_response else None,
        )

    # Build a tree: top-level comments + nested replies
    comments_by_id: dict[int, schemas.CommentResponse] = {}
    for comment in comments:
        comments_by_id[cast(int, comment.id)] = build_comment_response(comment)

    top_level: list[schemas.CommentResponse] = []
    for comment in comments:
        response = comments_by_id[cast(int, comment.id)]
        parent_id = cast(int, comment.parent_id) if comment.parent_id is not None else None
        if parent_id and parent_id in comments_by_id:
            parent_response = comments_by_id[parent_id]
            parent_response.replies = parent_response.replies or []
            parent_response.replies.append(response)
        else:
            top_level.append(response)

    return top_level


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

    comment.content = cast(Any, request.content.strip())
    db.commit()
    db.refresh(comment)

    # Re-extract mentions from updated content (multi-word names supported)
    mentioned_usernames = [
        name
        for name in re.findall(
            r'@([\w]+(?: [A-Z][\w]*)*)',
            cast(str, comment.content),
        )
        if name.strip()
    ]
    # Clear old mentions
    db.query(models.Mention).filter(models.Mention.comment_id == comment_id).delete()
    db.commit()

    resolved_mentions: dict[str, "models.User"] = {}
    if mentioned_usernames:
        resolved_mentions = _resolve_mention_users(db, mentioned_usernames)
        _notify_mentioned_users(db, resolved_mentions, comment_id, cast(str, current_user.name))

    user_name = comment.user.name if comment.user else "Anonymous"
    user_initial = user_name.strip()[0].upper() if user_name.strip() else "A"

    mentions_response = []
    for raw_username in mentioned_usernames:
        mentioned_user = resolved_mentions.get(raw_username)
        if mentioned_user:
            mention = db.query(models.Mention).filter(
                models.Mention.comment_id == comment_id,
                models.Mention.mentioned_user_id == cast(int, mentioned_user.id)
            ).first()
            if mention:
                mentions_response.append({
                    "id": mention.id,
                    "comment_id": mention.comment_id,
                    "mentioned_user_id": mention.mentioned_user_id,
                    "mentioned_user_name": cast(str, mentioned_user.name),
                    "created_at": mention.created_at
                })

    return schemas.CommentResponse(
        id=cast(int, comment.id),
        blog_id=cast(int, comment.blog_id),
        user_id=cast(int, comment.user_id),
        parent_id=cast(int, comment.parent_id) if comment.parent_id is not None else None,
        content=cast(str, comment.content),
        created_at=cast(datetime, comment.created_at),
        user_name=cast(str, user_name),
        user_initial=cast(str, user_initial),
        mentions=mentions_response if mentions_response else None,
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


# Notification endpoints
@router.get("/notifications", response_model=list[schemas.NotificationResponse])
def get_notifications(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    notifications = (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id)
        .order_by(models.Notification.created_at.desc())
        .limit(100)
        .all()
    )

    if not notifications:
        return []

    # Bulk-resolve actor profile pictures (one IN query instead of one per notification)
    actor_names = list({
        cast(str, n.actor_name)
        for n in notifications
        if n.actor_name is not None
    })
    actor_pic_map: dict[str, Optional[str]] = {}
    if actor_names:
        actor_users = db.query(models.User).filter(models.User.name.in_(actor_names)).all()
        actor_pic_map = {
            cast(str, u.name): _profile_picture_or_none(u.profile_picture_url)
            for u in actor_users
        }

    # Bulk-resolve comment references (one IN query instead of one per notification)
    comment_ids = [
        cast(int, n.reference_id)
        for n in notifications
        if cast(str, n.reference_type) == "comment"
    ]
    comment_blog_map: dict[int, int] = {}
    if comment_ids:
        comment_rows = (
            db.query(models.Comment.id, models.Comment.blog_id)
            .filter(models.Comment.id.in_(comment_ids))
            .all()
        )
        comment_blog_map = {cid: bid for cid, bid in comment_rows}

    result: list[schemas.NotificationResponse] = []
    for notification in notifications:
        actor_name = cast(Optional[str], notification.actor_name)
        actor_profile_picture_url = actor_pic_map.get(actor_name) if actor_name else None

        # Resolve navigation targets
        blog_id = None
        comment_id = None
        reference_type = cast(str, notification.reference_type)
        if reference_type == "blog":
            blog_id = cast(int, notification.reference_id)
        elif reference_type == "comment":
            comment_id = cast(int, notification.reference_id)
            blog_id = comment_blog_map.get(comment_id)

        message = schemas.NotificationResponse.build_message(
            cast(str, notification.type), actor_name
        )

        result.append(schemas.NotificationResponse(
            id=cast(int, notification.id),
            user_id=cast(int, notification.user_id),
            type=cast(str, notification.type),
            reference_type=cast(str, notification.reference_type),
            reference_id=cast(int, notification.reference_id),
            is_read=bool(notification.is_read),
            created_at=cast(datetime, notification.created_at),
            message=message,
            actor_name=actor_name,
            actor_profile_picture_url=actor_profile_picture_url,
            blog_id=cast(Optional[int], blog_id),
            comment_id=comment_id,
        ))

    return result


@router.post("/notifications/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_notifications_read(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == False
    ).update({models.Notification.is_read: True})
    db.commit()
    return None


@router.put("/notifications/{notif_id}/read", status_code=status.HTTP_202_ACCEPTED)
def mark_notification_read(
    notif_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    notification = db.query(models.Notification).filter(
        models.Notification.id == notif_id,
        models.Notification.user_id == current_user.id
    ).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = cast(Any, True)
    db.commit()
    return notification


@router.get("/notifications/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    count = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == False
    ).count()
    return {"unread_count": count}