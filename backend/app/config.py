"""
Lumora Site Configuration
===========================
All values here are READABLE CODE — change them directly when needed.
They are NOT stored in the database, so they cannot be altered through
the UI. This makes the owner account immune to being removed, demoted,
or deactivated by any admin panel action.

TO CHANGE THE OWNER:
  1. Update MAIN_ADMIN_EMAIL below.
  2. Update the seeded password in main.py (DEFAULT_STAFF) to match.
  3. Restart the server.

TO TRANSFER OWNERSHIP when selling the site:
  1. Update MAIN_ADMIN_EMAIL and password in main.py.
  2. Run the app so the new owner account is seeded.
  3. The old owner account (if demoted to user) can then be removed.
"""

from dotenv import load_dotenv
import os

load_dotenv()

# The email address of the single main admin (owner) of this site.
# This account has absolute power and can never be removed, demoted,
# or deactivated through the admin panel by any other user.
MAIN_ADMIN_EMAIL = os.getenv("MAIN_ADMIN_EMAIL", "admin@lumora.com")

# ---------------------------------------------------------------------------
# Supabase Storage (blog cover images)
# ---------------------------------------------------------------------------
# These values live only server-side (read from .env). The service_role key
# must NEVER be exposed to the frontend or included in any template/static file.
SUPABASE_URL = (os.getenv("SUPABASE_URL", "") or "").strip().rstrip("/")
SUPABASE_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "blog-images").strip()
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

# Hard upload cap (bytes). Client downscales to ~1200x675 WebP (~50-200KB),
# so anything larger than this is rejected server-side.
MAX_IMAGE_UPLOAD_BYTES = int(os.getenv("MAX_IMAGE_UPLOAD_BYTES", "5242880"))  # 5 MB
