import html
import json
import os
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, cast

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from jose import JWTError
from PIL import Image
from sqlalchemy import and_, case, func, or_
from sqlalchemy.orm import Session, joinedload

from backend.app import models, schemas, supabase_storage
from backend.app.database import SessionLocal, get_db
from backend.app.oath2 import get_current_user
from backend.app.token import verify_token

router = APIRouter(prefix="/chat", tags=["chat"])


# ---------------------------------------------------------------------------
# Connection Lifecycle Handler
# ---------------------------------------------------------------------------
class ConnectionManager:
    """
    Manages active WebSocket connections for authenticated users and guests.
    Thread-safe async tracking of user sockets with multi-tab support.
    """

    def __init__(self):
        # Map: user_id -> Set of active WebSocket instances
        self.user_sockets: Dict[int, Set[WebSocket]] = {}
        # Set of active anonymous/guest WebSockets
        self.guest_sockets: Set[WebSocket] = set()
        # Map: WebSocket -> user_id (for reverse lookup)
        self.socket_user_map: Dict[WebSocket, Optional[int]] = {}

    async def connect_user(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.user_sockets:
            self.user_sockets[user_id] = set()
        self.user_sockets[user_id].add(websocket)
        self.socket_user_map[websocket] = user_id
        await self.broadcast_presence()

    async def connect_guest(self, websocket: WebSocket):
        await websocket.accept()
        self.guest_sockets.add(websocket)
        self.socket_user_map[websocket] = None
        await self.broadcast_presence()

    async def disconnect(self, websocket: WebSocket):
        user_id = self.socket_user_map.pop(websocket, None)
        if user_id is not None:
            if user_id in self.user_sockets:
                self.user_sockets[user_id].discard(websocket)
                if not self.user_sockets[user_id]:
                    del self.user_sockets[user_id]
        else:
            self.guest_sockets.discard(websocket)
        await self.broadcast_presence()

    def is_online(self, user_id: int) -> bool:
        return user_id in self.user_sockets and len(self.user_sockets[user_id]) > 0

    def get_online_user_ids(self) -> List[int]:
        return list(self.user_sockets.keys())

    def get_online_count(self) -> int:
        return len(self.user_sockets) + len(self.guest_sockets)

    async def broadcast_presence(self):
        online_count = self.get_online_count()
        payload = {
            "type": "presence_update",
            "data": {
                "online_count": online_count,
                "online_users": [],  # TODO: Fetch actual user objects
            }
        }
        await self.broadcast_all(payload)

    async def broadcast_all(self, message: dict):
        dead_sockets: List[WebSocket] = []
        for sockets in list(self.user_sockets.values()):
            for ws in list(sockets):
                try:
                    await ws.send_json(message)
                except Exception:
                    dead_sockets.append(ws)

        for ws in list(self.guest_sockets):
            try:
                await ws.send_json(message)
            except Exception:
                dead_sockets.append(ws)

        for ws in dead_sockets:
            await self.disconnect(ws)

    async def send_to_user(self, user_id: int, message: dict) -> bool:
        sockets = self.user_sockets.get(user_id)
        if not sockets:
            return False
        dead_sockets: List[WebSocket] = []
        for ws in list(sockets):
            try:
                await ws.send_json(message)
            except Exception:
                dead_sockets.append(ws)

        for ws in dead_sockets:
            await self.disconnect(ws)
        return True


manager = ConnectionManager()


# ---------------------------------------------------------------------------
# Helper: Authenticate WebSocket from token string
# ---------------------------------------------------------------------------
def authenticate_token(token_str: Optional[str], db: Session) -> Optional[models.User]:
    if not token_str:
        return None
    if token_str.startswith("Bearer "):
        token_str = token_str[7:].strip()
    try:
        credentials_exception = HTTPException(status_code=401, detail="Invalid token")
        email = verify_token(token_str, credentials_exception)
        user = db.query(models.User).filter(models.User.email == email).first()
        return user
    except Exception:
        return None


def sanitize_text(text: str) -> str:
    """Strip dangerous HTML tags and trim excess whitespace."""
    if not text:
        return ""
    clean = html.escape(text.strip())
    return clean[:4000]



# ---------------------------------------------------------------------------
# WebSocket Endpoint: /ws/chat
# ---------------------------------------------------------------------------
@router.websocket("/ws/chat")
async def websocket_chat_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    current_user: Optional[models.User] = None
    try:
        if token:
            # Short-lived auth session: released immediately, not pinned for socket lifetime
            auth_db: Session = SessionLocal()
            try:
                current_user = authenticate_token(token, auth_db)
            finally:
                auth_db.close()

        if current_user:
            await manager.connect_user(websocket, cast(int, current_user.id))
            await websocket.send_json(
                {
                    "type": "auth_success",
                    "data": {
                        "user": {
                            "id": current_user.id,
                            "name": current_user.name,
                            "email": current_user.email,
                            "role": current_user.role or "user",
                            "profile_picture_url": current_user.profile_picture_url,
                        },
                        "online_count": manager.get_online_count(),
                        "online_users": [],  # TODO: Fetch actual user objects
                    }
                }
            )
        else:
            await manager.connect_guest(websocket)
            await websocket.send_json(
                {
                    "type": "guest_connected",
                    "data": {
                        "online_count": manager.get_online_count(),
                        "online_users": [],
                    }
                }
            )

        while True:
            data = await websocket.receive_text()
            try:
                msg_payload = json.loads(data)
            except json.JSONDecodeError:
                continue

            msg_type = msg_payload.get("type")

            if msg_type == "authenticate":
                auth_token = msg_payload.get("token")
                auth_db = SessionLocal()
                try:
                    user = authenticate_token(auth_token, auth_db)
                finally:
                    auth_db.close()
                if user:
                    if not current_user:
                        manager.guest_sockets.discard(websocket)
                    current_user = user
                    uid = cast(int, user.id)
                    manager.socket_user_map[websocket] = uid
                    if uid not in manager.user_sockets:
                        manager.user_sockets[uid] = set()
                    manager.user_sockets[uid].add(websocket)
                    await websocket.send_json(
                        {
                            "type": "auth_success",
                            "data": {
                                "user": {
                                    "id": current_user.id,
                                    "name": current_user.name,
                                    "email": current_user.email,
                                    "role": current_user.role or "user",
                                    "profile_picture_url": current_user.profile_picture_url,
                                },
                                "online_count": manager.get_online_count(),
                                "online_users": [],
                            }
                        }
                    )
                    await manager.broadcast_presence()
                continue

            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            if msg_type == "global_message":
                raw_body = msg_payload.get("message", "")
                clean_body = sanitize_text(raw_body)
                if not clean_body:
                    continue

                guest_name = msg_payload.get("guest_name", "Anonymous")
                author_name = current_user.name if current_user else guest_name
                user_id = current_user.id if current_user else None

                ws_db: Session = SessionLocal()
                try:
                    db_msg = models.GlobalMessage(
                        user_id=user_id,
                        author_name=author_name,
                        message_body=clean_body,
                        created_at=datetime.now(timezone.utc),
                    )
                    ws_db.add(db_msg)
                    ws_db.commit()
                    ws_db.refresh(db_msg)
                finally:
                    ws_db.close()

                out_event = {
                    "type": "global_message",
                    "data": {
                        "id": db_msg.id,
                        "user_id": user_id,
                        "author_name": author_name,
                        "author_role": current_user.role if current_user else "guest",
                        "author_avatar": current_user.profile_picture_url if current_user else None,
                        "message_body": db_msg.message_body,
                        "created_at": db_msg.created_at.isoformat() if db_msg.created_at is not None else datetime.now(timezone.utc).isoformat(),
                    },
                }
                await manager.broadcast_all(out_event)
                continue

            if msg_type == "private_message":
                if not current_user:
                    await websocket.send_json(
                        {"type": "error", "message": "Authentication required for private messages."}
                    )
                    continue

                recipient_id = msg_payload.get("recipient_id")
                raw_body = msg_payload.get("message", "")
                clean_body = sanitize_text(raw_body)

                if not recipient_id or not clean_body:
                    continue

                ws_db = SessionLocal()
                try:
                    recipient = ws_db.query(models.User).filter(models.User.id == int(recipient_id)).first()
                    if not recipient:
                        await websocket.send_json({"type": "error", "message": "Recipient not found."})
                        continue
                    db_private = models.PrivateMessage(
                        sender_id=current_user.id,
                        receiver_id=recipient.id,
                        message_body=clean_body,
                        is_read=False,
                        created_at=datetime.now(timezone.utc),
                    )
                    ws_db.add(db_private)
                    ws_db.commit()
                    ws_db.refresh(db_private)
                finally:
                    ws_db.close()

                out_event = {
                    "type": "private_message",
                    "data": {
                        "id": db_private.id,
                        "sender_id": current_user.id,
                        "receiver_id": recipient.id,
                        "message_body": db_private.message_body,
                        "is_read": False,
                        "created_at": db_private.created_at.isoformat() if db_private.created_at is not None else datetime.now(timezone.utc).isoformat(),
                        "sender_name": current_user.name,
                        "sender_avatar": current_user.profile_picture_url,
                        "sender_role": current_user.role or "user",
                        "receiver_name": recipient.name,
                        "receiver_avatar": recipient.profile_picture_url,
                    },
                }

                await manager.send_to_user(cast(int, recipient.id), out_event)
                await manager.send_to_user(cast(int, current_user.id), out_event)
                continue

            if msg_type == "typing":
                if not current_user:
                    continue
                channel = msg_payload.get("channel", "global")
                is_typing = bool(msg_payload.get("is_typing", True))

                if channel == "private":
                    recipient_id = msg_payload.get("recipient_id")
                    if recipient_id:
                        typing_event = {
                            "type": "typing",
                            "data": {
                                "user_id": current_user.id,
                                "user_name": current_user.name,
                                "channel": "private",
                                "recipient_id": int(recipient_id),
                                "is_typing": is_typing,
                            },
                        }
                        await manager.send_to_user(int(recipient_id), typing_event)
                else:
                    typing_event = {
                        "type": "typing",
                        "data": {
                            "user_id": current_user.id,
                            "user_name": current_user.name,
                            "channel": "global",
                            "is_typing": is_typing,
                        },
                    }
                    await manager.broadcast_all(typing_event)
                continue

            if msg_type == "read_receipt":
                if not current_user:
                    continue
                other_user_id = msg_payload.get("sender_id")
                if other_user_id:
                    ws_db = SessionLocal()
                    try:
                        ws_db.query(models.PrivateMessage).filter(
                            models.PrivateMessage.sender_id == int(other_user_id),
                            models.PrivateMessage.receiver_id == current_user.id,
                            models.PrivateMessage.is_read == False,
                        ).update({"is_read": True}, synchronize_session=False)
                        ws_db.commit()
                    finally:
                        ws_db.close()

                    receipt_event = {
                        "type": "read_receipt",
                        "data": {
                            "reader_id": current_user.id,
                            "sender_id": int(other_user_id),
                        },
                    }
                    await manager.send_to_user(int(other_user_id), receipt_event)
                continue

    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception as e:
        print("WebSocket chat session error:", e)
        await manager.disconnect(websocket)



# ---------------------------------------------------------------------------
# REST API Endpoints
# ---------------------------------------------------------------------------

@router.get("/global/history", response_model=List[schemas.GlobalMessageResponse])
def get_global_history(
    limit: int = Query(50, ge=1, le=100),
    before_id: Optional[int] = Query(None, description="Load messages before this ID for pagination"),
    db: Session = Depends(get_db),
):
    """
    Fetch global chat messages with cursor-based pagination.
    - limit: Number of messages to fetch (default 50, max 100)
    - before_id: Load messages older than this ID for infinite scroll
    """
    query = db.query(models.GlobalMessage)
    
    if before_id:
        query = query.filter(models.GlobalMessage.id < before_id)
    
    raw_messages = (
        query.options(joinedload(models.GlobalMessage.user))
        .order_by(models.GlobalMessage.created_at.desc())
        .limit(limit)
        .all()
    )
    messages = list(reversed(raw_messages))

    results = []
    for msg in messages:
        author_role = "guest"
        author_avatar = None
        author_name = cast(Optional[str], msg.author_name) or "Anonymous"
        if msg.user:
            author_role = "user"
            author_avatar = cast(Optional[str], msg.user.profile_picture_url)
            if msg.user.name:
                author_name = cast(str, msg.user.name)
            if msg.user.role:
                author_role = cast(str, msg.user.role)

        results.append(
            schemas.GlobalMessageResponse(
                id=cast(int, msg.id),
                user_id=cast(Optional[int], msg.user_id),
                author_name=author_name,
                author_role=author_role,
                author_avatar=author_avatar,
                message_body=cast(str, msg.message_body),
                created_at=(cast(datetime, msg.created_at) if msg.created_at is not None else datetime.now(timezone.utc)),
            )
        )
    return results


@router.get("/conversations", response_model=List[schemas.ConversationResponse])
def get_conversations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Fetch all active private conversations for current user with
    unread count, latest message snippet, timestamp, and peer status.
    """
    current_user_id = cast(int, current_user.id)

    sent_peers = (
        db.query(models.PrivateMessage.receiver_id)
        .filter(models.PrivateMessage.sender_id == current_user_id)
        .distinct()
        .all()
    )
    recv_peers = (
        db.query(models.PrivateMessage.sender_id)
        .filter(models.PrivateMessage.receiver_id == current_user_id)
        .distinct()
        .all()
    )

    peer_ids = set([r[0] for r in sent_peers] + [r[0] for r in recv_peers])
    if not peer_ids:
        return []

    users = db.query(models.User).filter(models.User.id.in_(peer_ids)).all()
    user_map = {u.id: u for u in users}

    PM = models.PrivateMessage

    # Latest message per conversation pair in ONE query. A row-numbered window
    # over the unordered (sender, receiver) pair picks the newest message per
    # conversation; `CASE` keeps the pair key portable (Postgres + SQLite).
    # This replaces the previous per-peer last-message query (N round-trips).
    sender, receiver = PM.sender_id, PM.receiver_id
    pair_a = case((sender <= receiver, sender), else_=receiver)
    pair_b = case((sender <= receiver, receiver), else_=sender)
    rn = func.row_number().over(
        partition_by=(pair_a, pair_b),
        order_by=PM.created_at.desc(),
    ).label("rn")

    last_sub = (
        db.query(
            pair_a.label("pa"),
            pair_b.label("pb"),
            PM.message_body.label("last_body"),
            PM.created_at.label("last_at"),
            PM.sender_id.label("last_sender"),
            rn,
        )
        .filter(or_(sender == current_user_id, receiver == current_user_id))
        .subquery()
    )
    last_rows = db.query(last_sub).filter(last_sub.c.rn == 1).all()
    last_map = {}
    for pa, pb, last_body, last_at, last_sender, _ in last_rows:
        peer = pb if pa == current_user_id else pa
        last_map[peer] = (last_body, last_at, last_sender)

    # Unread counts for every peer in ONE grouped query (replaces one query
    # per peer).
    unread_map = {
        row[0]: row[1]
        for row in db.query(PM.sender_id, func.count(PM.id))
        .filter(
            PM.receiver_id == current_user_id,
            PM.is_read == False,
            PM.sender_id.in_(list(last_map.keys())),
        )
        .group_by(PM.sender_id)
        .all()
    }

    conversations = []
    for pid in peer_ids:
        peer = user_map.get(pid)
        if not peer:
            continue

        last = last_map.get(pid)
        if last is None:
            continue
        last_body, last_created, last_sender = last

        is_online = manager.is_online(cast(int, peer.id))

        conversations.append(
            schemas.ConversationResponse(
                user=schemas.ChatUserResponse(
                    id=cast(int, peer.id),
                    name=cast(str, peer.name),
                    email=cast(str, peer.email),
                    role=(cast(str, peer.role) or "user"),
                    profile_picture_url=cast(Optional[str], peer.profile_picture_url),
                    is_online=is_online,
                ),
                last_message=cast(str, last_body),
                last_message_time=(cast(datetime, last_created) if last_created is not None else datetime.now(timezone.utc)),
                unread_count=unread_map.get(pid, 0),
                last_sender_id=cast(int, last_sender),
            )
        )

    conversations.sort(key=lambda c: c.last_message_time, reverse=True)
    return conversations



@router.get("/private/{recipient_id}/history", response_model=List[schemas.PrivateMessageResponse])
def get_private_history(
    recipient_id: int,
    limit: int = Query(50, ge=1, le=100),
    before_id: Optional[int] = Query(None, description="Load messages before this ID for pagination"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Fetch private message history with cursor-based pagination.
    - limit: Number of messages to fetch (default 50, max 100)
    - before_id: Load messages older than this ID for infinite scroll
    """
    current_user_id = cast(int, current_user.id)
    recipient = db.query(models.User).filter(models.User.id == recipient_id).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient user not found")

    query = db.query(models.PrivateMessage).filter(
        or_(
            and_(
                models.PrivateMessage.sender_id == current_user_id,
                models.PrivateMessage.receiver_id == recipient_id,
            ),
            and_(
                models.PrivateMessage.sender_id == recipient_id,
                models.PrivateMessage.receiver_id == current_user_id,
            ),
        )
    )
    
    if before_id:
        query = query.filter(models.PrivateMessage.id < before_id)

    raw_messages = (
        query
        .order_by(models.PrivateMessage.created_at.desc())
        .limit(limit)
        .all()
    )
    messages = list(reversed(raw_messages))

    results = []
    for msg in messages:
        is_mine = (cast(int, msg.sender_id) == current_user_id)
        sender_name = current_user.name if is_mine else recipient.name
        sender_avatar = current_user.profile_picture_url if is_mine else recipient.profile_picture_url
        receiver_name = recipient.name if is_mine else current_user.name
        receiver_avatar = recipient.profile_picture_url if is_mine else current_user.profile_picture_url

        results.append(
            schemas.PrivateMessageResponse(
                id=cast(int, msg.id),
                sender_id=cast(int, msg.sender_id),
                receiver_id=cast(int, msg.receiver_id),
                message_body=cast(str, msg.message_body),
                is_read=cast(bool, msg.is_read),
                created_at=(cast(datetime, msg.created_at) if msg.created_at is not None else datetime.now(timezone.utc)),
                sender_name=cast(Optional[str], sender_name),
                sender_avatar=cast(Optional[str], sender_avatar),
                receiver_name=cast(Optional[str], receiver_name),
                receiver_avatar=cast(Optional[str], receiver_avatar),
            )
        )
    return results


@router.post("/private/{recipient_id}/read")
def mark_private_read(
    recipient_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Mark all unread messages from recipient_id to current_user as read."""
    current_user_id = cast(int, current_user.id)
    updated_rows = (
        db.query(models.PrivateMessage)
        .filter(
            models.PrivateMessage.sender_id == recipient_id,
            models.PrivateMessage.receiver_id == current_user_id,
            models.PrivateMessage.is_read == False,
        )
        .update({"is_read": True}, synchronize_session=False)
    )
    db.commit()
    return {"status": "ok", "marked_read": updated_rows}


@router.get("/users", response_model=List[schemas.ChatUserResponse])
def get_chat_users(
    q: Optional[str] = None,
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: Session = Depends(get_db),
):
    """
    Search/list registered users available for direct messaging with pagination.
    - q: Search query (name or email)
    - limit: Number of users to return (default 30, max 100)
    - offset: Skip first N users for pagination
    """
    query = db.query(models.User).filter(models.User.is_active == True)
    if q and q.strip():
        search_pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                models.User.name.ilike(search_pattern),
                models.User.email.ilike(search_pattern),
            )
        )

    # Order by name for consistent pagination
    users = query.order_by(models.User.name).offset(offset).limit(limit).all()
    results = []
    for u in users:
        results.append(
            schemas.ChatUserResponse(
                id=cast(int, u.id),
                name=cast(str, u.name),
                email=cast(str, u.email),
                role=(cast(str, u.role) or "user"),
                profile_picture_url=cast(Optional[str], u.profile_picture_url),
                is_online=manager.is_online(cast(int, u.id)),
            )
        )
    return results


@router.get("/unread-count")
def get_total_unread_count(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get total unread private messages count for the navbar badge."""
    current_user_id = cast(int, current_user.id)
    total_unread = (
        db.query(models.PrivateMessage)
        .filter(
            models.PrivateMessage.receiver_id == current_user_id,
            models.PrivateMessage.is_read == False,
        )
        .count()
    )
    return {"unread_count": total_unread}


# Content types served from Storage for chat attachments (matches allowed_exts).
CHAT_CONTENT_TYPES = {
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".zip": "application/zip",
}


@router.post("/upload")
async def upload_chat_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Upload an image or document attachment for chat. Images auto-convert to WebP.

    Files are stored in Supabase Storage (durable across redeploys) and the
    returned public URL goes into the message body — the old local-disk
    `static/uploads/chat/` path was wiped on every Render redeploy.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected")

    allowed_exts = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".pdf", ".txt", ".zip"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds 10MB limit")

    # Auto-convert raster images to WebP for better compression.
    convertible_images = {".png", ".jpg", ".jpeg", ".gif"}
    if ext in convertible_images:
        try:
            img = Image.open(BytesIO(contents))
            if img.mode in ("RGBA", "LA", "P"):
                img = img.convert("RGBA")
            elif img.mode != "RGB":
                img = img.convert("RGB")
            output = BytesIO()
            img.save(output, format="WEBP", quality=85, method=6)
            contents = output.getvalue()
            ext = ".webp"
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Image conversion failed: {str(e)}")

    if not supabase_storage.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="File storage is not configured on the server.",
        )

    # Extension-safe display name so the stored object keeps the right suffix
    # (e.g. `photo.png` -> `photo.webp` after conversion).
    storage_filename = f"{Path(file.filename).stem}{ext}"

    try:
        file_url = await supabase_storage.upload_chat_file(
            user_id=cast(int, current_user.id),
            file_bytes=contents,
            original_filename=storage_filename,
            content_type=CHAT_CONTENT_TYPES.get(ext, "application/octet-stream"),
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to upload file to storage. Please try again later.",
        )

    is_image = ext in {".webp", ".svg"}

    return {
        "url": file_url,
        "filename": file.filename,
        "is_image": is_image,
        "size": len(contents),
    }

