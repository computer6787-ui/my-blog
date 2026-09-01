from fastapi import Depends, FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from pathlib import Path
from sqlalchemy import text, inspect
from . import models
from .database import engine
from ..routers import blog, user, auth, verify, interact

Parent_DIR = Path(__file__).resolve().parent.parent.parent

BASE_DIR = Parent_DIR / "backend"

templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def init_db():
    try:
        models.base.metadata.create_all(engine)
        insp = inspect(engine)
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
    except Exception as e:
        print("Database initialization notice:", e)

init_db()

app.include_router(blog.router)
app.include_router(user.router)
app.include_router(auth.router)
app.include_router(verify.router)
app.include_router(interact.router)


app.mount(
    "/static",
    StaticFiles(directory=str(BASE_DIR / "static")),
    name="static"
)

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
        context={}
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
