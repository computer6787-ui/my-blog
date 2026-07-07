from fastapi import FastAPI,Depends,status,Response,HTTPException,APIRouter
from ..encryption import Encrypting
from .. import schemas,models
from ..database import engine,SessionLocal,get_db
from sqlalchemy.orm import session
from ..repository import user_func


router=APIRouter(
    tags=["user"],
    prefix="/user"
)


@router.post("/")
def create_user(request:schemas.User,db:session=Depends(get_db)):
    return user_func.create_user(request,db)


@router.get("/{id}",response_model=schemas.Show_user)
def show_user(id,db:session=Depends(get_db)):
    return user_func.show_user(id,db)