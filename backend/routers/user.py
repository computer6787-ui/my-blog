from fastapi import FastAPI,Depends,status,Response,HTTPException,APIRouter

from ..app import models
from ..app.encryption import Encrypting
from ..app import schemas
from ..app.database import engine,SessionLocal,get_db
from sqlalchemy.orm import session
from ..repository import user_repository
from ..app import oath2


router=APIRouter(
    tags=["user"],
    prefix="/user"
)


@router.post("/")
async def create_pending_user(request:schemas.User,db:session=Depends(get_db)):
    return await user_repository.create_pending_user(request,db)

@router.get("/me", response_model=schemas.Show_user)
def me(current_user: models.User = Depends(oath2.get_current_user)):
    return current_user

@router.get("/{id}",response_model=schemas.Show_user)
def show_user(id: int, db: session = Depends(get_db)):
    return user_repository.show_user(id,db) 