from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, Request
from fastapi.responses import FileResponse, PlainTextResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from pathlib import Path
from sqlalchemy import text, inspect
from datetime import datetime, timezone
from . import models
from .database import engine, SessionLocal
from .encryption import Encrypting
from .config import MAIN_ADMIN_EMAIL
from .cleanup_service import start_cleanup_scheduler, stop_cleanup_scheduler
from ..routers import blog, user, auth, verify, interact, admin, chat

Parent_DIR = Path(__file__).resolve().parent.parent.parent

BASE_DIR = Parent_DIR / "backend"

templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan context manager
    Startup: Initialize database and start cleanup scheduler
    Shutdown: Stop cleanup scheduler
    """
    # Startup
    print("\n" + "="*60)
    print("🚀 STARTING CHAT APPLICATION")
    print("="*60)
    init_db()
    seed_default_staff()
    start_cleanup_scheduler()
    print("✅ Application started successfully")
    print("="*60 + "\n")
    
    yield
    
    # Shutdown
    print("\n" + "="*60)
    print("⏹️  SHUTTING DOWN CHAT APPLICATION")
    print("="*60)
    stop_cleanup_scheduler()
    print("✅ Application shutdown complete")
    print("="*60 + "\n")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def seed_default_staff():
    """Create the default admin + moderator accounts if they do not exist yet."""
    try:
        db = SessionLocal()
        try:
            DEFAULT_STAFF = [
                {"name": "Admin", "email": MAIN_ADMIN_EMAIL, "password": "admin123", "role": "admin"},
                {"name": "Moderator One", "email": "mod1@lumora.com", "password": "mod123", "role": "moderator"},
                {"name": "Moderator Two", "email": "mod2@lumora.com", "password": "mod123", "role": "moderator"},
                {"name": "Moderator Three", "email": "mod3@lumora.com", "password": "mod123", "role": "moderator"},
            ]
            for staff in DEFAULT_STAFF:
                existing = db.query(models.User).filter(
                    models.User.email.ilike(staff["email"])
                ).first()
                if not existing:
                    new_user = models.User(
                        name=staff["name"],
                        email=staff["email"].lower(),
                        hashed_password=Encrypting.bcrypt(staff["password"]),
                        role=staff["role"],
                        is_active=True,
                    )
                    db.add(new_user)
            db.commit()
        finally:
            db.close()
    except Exception as e:
        print("Default staff seed notice:", e)


def init_db():
    try:
        models.base.metadata.create_all(engine)
        insp = inspect(engine)

        if "comments" in insp.get_table_names():
            comment_cols = [c["name"] for c in insp.get_columns("comments")]
            if "parent_id" not in comment_cols:
                with engine.connect() as conn:
                    conn.execute(text("ALTER TABLE comments ADD COLUMN parent_id INTEGER;"))
                    conn.commit()

        if "notifications" in insp.get_table_names():
            notif_cols = [c["name"] for c in insp.get_columns("notifications")]
            if "actor_name" not in notif_cols:
                with engine.connect() as conn:
                    conn.execute(text("ALTER TABLE notifications ADD COLUMN actor_name VARCHAR;"))
                    conn.commit()

        if "blogs" in insp.get_table_names():
            cols = [c["name"] for c in insp.get_columns("blogs")]
            if "image_url" not in cols:
                with engine.connect() as conn:
                    conn.execute(text("ALTER TABLE blogs ADD COLUMN image_url VARCHAR;"))
                    conn.commit()
            if "category" not in cols:
                with engine.connect() as conn:
                    conn.execute(text("ALTER TABLE blogs ADD COLUMN category VARCHAR;"))
                    conn.commit()
            if "created_at" not in cols:
                dialect = engine.dialect.name
                if dialect.startswith("postgres"):
                    created_at_sql = "TIMESTAMP WITHOUT TIME ZONE"
                    set_null_sql = "UPDATE blogs SET created_at = NOW() WHERE created_at IS NULL;"
                else:
                    created_at_sql = "DATETIME"
                    set_null_sql = "UPDATE blogs SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;"

                with engine.connect() as conn:
                    conn.execute(text(f"ALTER TABLE blogs ADD COLUMN created_at {created_at_sql};"))
                    conn.execute(text(set_null_sql))
                    conn.commit()

        if "users" in insp.get_table_names():
            user_cols = [c["name"] for c in insp.get_columns("users")]
            for column_name, column_sql in {
                "profile_picture_url": "ALTER TABLE users ADD COLUMN profile_picture_url VARCHAR;",
                "bio": "ALTER TABLE users ADD COLUMN bio VARCHAR;",
                "location": "ALTER TABLE users ADD COLUMN location VARCHAR;",
                "hobby": "ALTER TABLE users ADD COLUMN hobby VARCHAR;",
                "occupation": "ALTER TABLE users ADD COLUMN occupation VARCHAR;",
                "education": "ALTER TABLE users ADD COLUMN education VARCHAR;",
                "facebook": "ALTER TABLE users ADD COLUMN facebook VARCHAR;",
                "instagram": "ALTER TABLE users ADD COLUMN instagram VARCHAR;",
                "role": "ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'user';",
                "is_active": "ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;",
            }.items():
                if column_name not in user_cols:
                    with engine.connect() as conn:
                        conn.execute(text(column_sql))
                        conn.commit()

        # Ensure private_messages has all required columns
        if "private_messages" in insp.get_table_names():
            pm_cols = [c["name"] for c in insp.get_columns("private_messages")]
            for col_name, col_sql in {
                "is_read": "ALTER TABLE private_messages ADD COLUMN is_read BOOLEAN DEFAULT FALSE;",
            }.items():
                if col_name not in pm_cols:
                    with engine.connect() as conn:
                        conn.execute(text(col_sql))
                        conn.commit()

        # Ensure global_messages has all required columns
        if "global_messages" in insp.get_table_names():
            gm_cols = [c["name"] for c in insp.get_columns("global_messages")]
            for col_name, col_sql in {
                "author_name": "ALTER TABLE global_messages ADD COLUMN author_name VARCHAR;",
            }.items():
                if col_name not in gm_cols:
                    with engine.connect() as conn:
                        conn.execute(text(col_sql))
                        conn.commit()

        seed_default_staff()
    # Trim older notifications that exceed the retention limit for each user
        interact.prune_all_notifications()
    except Exception as e:
        print("Database initialization notice:", e)

init_db()

app.include_router(blog.router)
app.include_router(user.router)
app.include_router(auth.router)
app.include_router(verify.router)
app.include_router(interact.router)
app.include_router(admin.router)
app.include_router(chat.router)


app.mount(
    "/static",
    StaticFiles(directory=str(BASE_DIR / "static")),
    name="static"
)

@app.get("/googlecd638c7d6a56159d.html")
def google_site_verification():
    return PlainTextResponse("google-site-verification: googlecd638c7d6a56159d.html")


@app.get("/robots.txt")
def robots_txt():
    content = """User-agent: *
Allow: /
Disallow: /create-blog
Disallow: /edit-blog/
Disallow: /my-blogs
Disallow: /user
Disallow: /login
Disallow: /register
Disallow: /verify
Disallow: /resetPass
Disallow: /Verify_user
Disallow: /Update_pass

Sitemap: https://lumora-2g3u.onrender.com/sitemap.xml
"""
    return PlainTextResponse(content, media_type="text/plain")


@app.get("/sitemap.xml")
def sitemap_xml():
    db = SessionLocal()
    try:
        blogs = db.query(models.Blog).filter(models.Blog.published == True).order_by(models.Blog.id.desc()).all()

        urls_xml = ""
        # Homepage
        urls_xml += f"""
    <url>
        <loc>https://lumora-2g3u.onrender.com/</loc>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>"""

        # Static pages
        for path in ["/privacy-policy", "/terms-of-service"]:
            urls_xml += f"""
    <url>
        <loc>https://lumora-2g3u.onrender.com{path}</loc>
        <changefreq>monthly</changefreq>
        <priority>0.3</priority>
    </url>"""

        # Blog pages
        for blog_item in blogs:
            lastmod = blog_item.created_at.strftime("%Y-%m-%d") if blog_item.created_at is not None else datetime.now(timezone.utc).strftime("%Y-%m-%d")
            urls_xml += f"""
    <url>
        <loc>https://lumora-2g3u.onrender.com/blogs/{blog_item.id}</loc>
        <lastmod>{lastmod}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>"""

        xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    {urls_xml}
</urlset>"""
        return HTMLResponse(content=xml, media_type="application/xml")
    finally:
        db.close()


@app.get("/")
def Home_page(request: Request):
    return templates.TemplateResponse(
    request=request,
    name="index.html",
    context={}
    )

@app.get("/blogs/{id}")
def blog_page(request: Request, id: int):
    return templates.TemplateResponse(
    request=request,
    name="blog.html",
    context={"id": id}
)
@app.get("/login")
def login_page(request: Request):
    return templates.TemplateResponse(
    request=request,
    name="login.html",
    context={}
)

@app.get("/create-blog")
def create_blog(request:Request):
    return templates.TemplateResponse(
    request=request,
    name="create-blog.html",
    context={}    
     )


@app.get("/user")
def user_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="user.html",
        context={"is_own_profile": True, "profile_user_id": None}
    )

@app.get("/my-blogs")
def my_blogs_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="my-blogs.html",
        context={"is_own_profile": True, "profile_user_id": None}
    )

@app.get("/admin")
def admin_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="admin.html",
        context={}
    )

@app.get("/profile/{user_id}")
def public_profile_page(request: Request, user_id: int):
    return templates.TemplateResponse(
        request=request,
        name="public_profile.html",
        context={"is_own_profile": False, "profile_user_id": user_id}
    )

@app.get("/register")
def register(request:Request):
    return templates.TemplateResponse(
    request=request,
    name="register.html",
    context={}    
     )
@app.get("/edit-blog/{id}")
def edit_blog(request:Request, id: int):
    return templates.TemplateResponse(
    request=request,
    name="edit-blog.html",
    context={"id": id}
     )

@app.get("/verify")
def verify_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="verify.html",
        context={}
    )

@app.get("/resetPass")
def resetPass(request:Request):
    return templates.TemplateResponse(
    request=request,
    name="Email_ver.html",
    context={}
    )
@app.get("/Verify_user")
def verify_user_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="verify_user.html",
        context={}
    )
    
@app.get("/Update_pass")
def resetPass_verEmail(request:Request):
    return templates.TemplateResponse(
        request=request,
        name="update_pass.html",
        context={}
    )


@app.get("/privacy-policy")
def privacy_policy(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="privacy-policy.html",
        context={}
    )

@app.get("/terms-of-service")
def terms_of_service(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="terms-of-service.html",
        context={}
    )
