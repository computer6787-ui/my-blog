"""
Supabase Storage helper — server-side only.

Uses the service_role key (never exposed to browser) via httpx.

Bucket lifecycle:
  - ensure_bucket() is called once at startup; creates `blog-images` with
    public=true if it does not yet exist.
  - upload_blog_image(user_id, file_bytes, filename, content_type) streams
    to Storage and returns the public URL to store in blogs.image_url.
  - delete_from_storage(object_path_or_url) cleans up the file when a blog
    post is deleted.
"""

import logging
import re
import uuid
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse, unquote

import httpx

from . import config as app_config

logger = logging.getLogger("supabase_storage")


def _supabase_url() -> str:
    return (app_config.SUPABASE_URL or "").strip().rstrip("/")


def _bucket() -> str:
    return (app_config.SUPABASE_STORAGE_BUCKET or "blog-images").strip()


def _service_key() -> str:
    return (app_config.SUPABASE_SERVICE_ROLE_KEY or "").strip()


def _storage_base() -> str:
    return f"{_supabase_url()}/storage/v1"


def _is_configured() -> bool:
    return bool(_supabase_url() and _service_key())


def is_configured() -> bool:
    return _is_configured()


def public_url_for(object_name: str) -> str:
    base = _supabase_url()
    bucket = _bucket()
    name = object_name.lstrip("/")
    return f"{base}/storage/v1/object/public/{bucket}/{name}"


def is_storage_url(url: str) -> bool:
    if not url:
        return False
    return "/storage/v1/object/" in url


def extract_object_name(url_or_name: str) -> Optional[str]:
    if not url_or_name or not url_or_name.strip():
        return None
    raw = url_or_name.strip()
    if "/storage/v1/object/" not in raw:
        parsed = urlparse(raw)
        if parsed.scheme in ("http", "https"):
            return None
        return raw.lstrip("/")
    marker = "/storage/v1/object/"
    idx = raw.index(marker) + len(marker)
    tail = raw[idx:]
    parts = tail.split("/", 2)
    if parts[0] == "public":
        if len(parts) >= 3:
            return unquote(parts[2])
    else:
        if len(parts) >= 2:
            return unquote(parts[1])
    return None


# ---------------------------------------------------------------------------
# Startup: ensure bucket exists
# ---------------------------------------------------------------------------

async def ensure_bucket() -> bool:
    """Create blog-images bucket with public=true if it does not exist."""
    if not _is_configured():
        logger.warning("[Storage] Supabase not configured — skipping bucket creation.")
        return False

    bucket = _bucket()
    base = _storage_base()
    key = _service_key()
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    payload = {"id": bucket, "name": bucket, "public": True}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(f"{base}/bucket", headers=headers, json=payload)
            if resp.status_code in (200, 201):
                logger.info(f"[Storage] Bucket '{bucket}' created.")
                return True
            body = resp.text or ""
            if resp.status_code in (400, 409) and ("already exists" in body.lower() or "duplicate" in body.lower()):
                logger.info(f"[Storage] Bucket '{bucket}' already exists.")
                return True
            get_resp = await client.get(f"{base}/bucket/{bucket}", headers=headers)
            if get_resp.status_code == 200:
                logger.info(f"[Storage] Bucket '{bucket}' already exists (verified).")
                return True
            logger.warning(f"[Storage] ensure_bucket: HTTP {resp.status_code} {body[:300]}")
            return False
    except Exception as exc:
        logger.exception(f"[Storage] ensure_bucket exception: {exc}")
        return False


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

async def upload_blog_image(
    user_id: int,
    file_bytes: bytes,
    original_filename: str = "cover.webp",
    content_type: str = "image/webp",
) -> str:
    """
    Upload a blog cover image to Storage.
    Object key: <user_id>/<uuid>.webp — scoped by owner, collision-free.
    Returns the public URL. Raises RuntimeError on failure.
    """
    if not _is_configured():
        raise RuntimeError("Storage not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.")
    if not file_bytes:
        raise ValueError("Empty file.")

    bucket = _bucket()
    base = _storage_base()
    key = _service_key()

    lower = (original_filename or "").lower()
    ext = "jpg" if lower.endswith((".jpg", ".jpeg")) else "png" if lower.endswith(".png") else "webp"
    object_name = f"{user_id}/{uuid.uuid4().hex}.{ext}"
    url = f"{base}/object/{bucket}/{object_name}"

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": content_type or "image/webp",
        "x-upsert": "false",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, headers=headers, content=file_bytes)
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"Storage upload failed: {resp.text[:500]}")

    return public_url_for(object_name)


# ---------------------------------------------------------------------------
# Chat attachment upload
# ---------------------------------------------------------------------------

async def upload_chat_file(
    user_id: int,
    file_bytes: bytes,
    original_filename: str = "file",
    content_type: str = "application/octet-stream",
) -> str:
    """
    Upload a chat attachment to Storage under the `chat/<user_id>/` prefix,
    reusing the same public bucket. Keeps a readable, URL-safe filename so the
    UI can display the original name (mirrors the old local-disk naming:
    `<uuid12>_<stem>.<ext>`).

    Returns the public URL, which the message body references. This survives
    Render redeploys (unlike the old `static/uploads/chat/` disk path).
    Raises RuntimeError on failure.
    """
    if not _is_configured():
        raise RuntimeError("Storage not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.")
    if not file_bytes:
        raise ValueError("Empty file.")

    bucket = _bucket()
    base = _storage_base()
    key = _service_key()

    p = Path(original_filename or "file")
    stem = re.sub(r"[^\w.\-]+", "_", p.stem, flags=re.UNICODE).strip("._") or "file"
    ext = re.sub(r"[^a-z0-9]", "", p.suffix.lower()) or "bin"
    object_name = f"chat/{user_id}/{uuid.uuid4().hex[:12]}_{stem}.{ext}"
    url = f"{base}/object/{bucket}/{object_name}"

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": content_type or "application/octet-stream",
        "x-upsert": "false",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, headers=headers, content=file_bytes)
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"Storage upload failed: {resp.text[:500]}")

    return public_url_for(object_name)


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

async def delete_from_storage(url_or_object_name: str) -> bool:
    """
    Delete the object referenced by a Storage URL or bare object name.
    Returns True if deleted, False if not found/not a storage URL.
    Never raises — must not fail the surrounding DB transaction.
    """
    if not _is_configured():
        return False

    object_name = extract_object_name(url_or_object_name)
    if not object_name:
        return False

    bucket = _bucket()
    base = _storage_base()
    key = _service_key()
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.request("DELETE", f"{base}/object/{bucket}", headers=headers, json={"prefixes": [object_name]})
            if resp.status_code in (200, 204):
                return True
            fb = await client.delete(f"{base}/object/{bucket}/{object_name}", headers=headers)
            return fb.status_code in (200, 204)
    except Exception as exc:
        logger.warning(f"[Storage] delete failed for {object_name}: {exc}")
        return False