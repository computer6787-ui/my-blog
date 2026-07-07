from fastapi import Depends, FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend import oath2, schemas
from . import models
from .database import engine
from .routers import blog,user,auth
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm



app = FastAPI()
models.base.metadata.create_all(engine)
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

app.include_router(blog.router)
app.include_router(user.router)
app.include_router(auth.router)

app.mount(
    "/frontend",
    StaticFiles(directory=BASE_DIR / "frontend"),
    name="frontend"
)

@app.get("/")
def home():
    return FileResponse(BASE_DIR / "frontend" / "index.html")
@app.get("/blogs/{id}")
def blog_page(id: int):
    return FileResponse(BASE_DIR / "frontend" / "blog.html")
@app.get("/login")
def login_page():
    return FileResponse(BASE_DIR / "frontend" / "login.html")








 


