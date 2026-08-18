from fastapi import Depends, FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from . import models
from .database import engine
from ..routers import blog,user,auth,verify
from fastapi import Request
from fastapi.templating import Jinja2Templates
from pathlib import Path

Parent_DIR = Path(__file__).resolve().parent.parent.parent

BASE_DIR = Parent_DIR / "backend"



templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:8000", "http://localhost", "http://127.0.0.1"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

models.base.metadata.create_all(engine)

app.include_router(blog.router)
app.include_router(user.router)
app.include_router(auth.router)
app.include_router(verify.router)


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
def create_blog(request:Request):
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
def verify(request:Request):
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
def resetPass_verEmail(request:Request):
    return templates.TemplateResponse(
    request=request,
    name="verify_user.html",
    context={}
    )

@app.get("/game")
def game_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="game.html",
        context={}
    )

@app.get("/Update_pass")
def resetPass_verEmail(request:Request):
    return templates.TemplateResponse(
        request=request,
        name="update_pass.html",
        context={}
    )