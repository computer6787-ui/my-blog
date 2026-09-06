"""
One-time backfill: move legacy base64 profile avatars to Supabase Storage.

Finds every user whose profile_picture_url is an inline data URI (pre-migration
format), uploads the decoded bytes to Storage server-side (service_role key),
and swaps the row to the short public URL. This drops the multi-hundred-KB
base64 strings out of the database.

Idempotent — it only touches rows whose profile_picture_url still contains
'data:image', so re-running after a partial run is safe.

Usage:
    python -m backend.migrations.backfill_avatar_images
"""

import asyncio
import base64


from sqlalchemy import text

from backend.app.database import SessionLocal
from backend.app.supabase_storage import is_configured, upload_blog_image

# data:image/png;base64,... -> image/png
EXT_BY_MIME = {
    "image/png": "png",
    "image/webp": "webp",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
}


def main() -> None:
    if not is_configured():
        print("[backfill-avatars] Storage not configured — aborting.")
        return

    db = SessionLocal()
    try:
        rows = db.execute(
            text(
                "SELECT id, profile_picture_url FROM users "
                "WHERE profile_picture_url LIKE 'data:image%'"
            )
        ).all()
        if not rows:
            print("[backfill-avatars] No base64 profile avatars remain — nothing to do.")
            return

        print(f"[backfill-avatars] Found {len(rows)} base64 profile avatar(s). Migrating…")

        async def run() -> None:
            for user_id, image_url in rows:
                try:
                    header, _, b64 = str(image_url).partition(",")
                    content_type = header.split(";")[0].split(":", 1)[1].strip().lower()
                    data = base64.b64decode(b64)
                    ext = EXT_BY_MIME.get(content_type, "jpg")

                    url = await upload_blog_image(
                        user_id=int(user_id or 0),
                        file_bytes=data,
                        original_filename=f"avatar.{ext}",
                        content_type=content_type,
                    )

                    db.execute(
                        text("UPDATE users SET profile_picture_url = :u WHERE id = :i"),
                        {"u": url, "i": user_id},
                    )
                    db.commit()
                    print(
                        f"[backfill-avatars] user {user_id}: {len(data):,} B -> {url}"
                    )
                except Exception as exc:  # noqa: BLE001 — report and continue
                    db.rollback()
                    print(f"[backfill-avatars] user {user_id} FAILED: {exc}")

        asyncio.run(run())
    finally:
        db.close()


if __name__ == "__main__":
    main()