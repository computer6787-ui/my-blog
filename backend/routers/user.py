from fastapi import FastAPI,Depends,status,Response,HTTPException,APIRouter

from ..app import models
from ..app.encryption import Encrypting
from ..app import schemas
from ..app.database import engine,SessionLocal,get_db
from sqlalchemy.orm import Session
from ..repository import user_repository
from ..app import oath2


router=APIRouter(
    tags=["user"],
    prefix="/user"
)


@router.post("/")
async def create_pending_user(request:schemas.User,db: Session = Depends(get_db)):
    return await user_repository.create_pending_user(request,db)

@router.get("/me", response_model=schemas.Show_user)
def me(current_user: models.User = Depends(oath2.get_current_user)):
    return current_user

@router.get("/{id}",response_model=schemas.Show_user)
def show_user(id: int, db: Session = Depends(get_db)):
    return user_repository.show_user(id,db) 

@router.put("/edit_name",status_code=status.HTTP_202_ACCEPTED)
def update(request:schemas.edit_user,db: Session = Depends(get_db),current_user:models.User=Depends(oath2.get_current_user)):
    return user_repository.edit_user(request,db,current_user)

@router.put("/edit_pass",status_code=status.HTTP_202_ACCEPTED)
async def update_pass(request:schemas.Update_password,db: Session = Depends(get_db)):
    return await user_repository.update_pass(request,db)

@router.post("/ver_email",status_code=status.HTTP_202_ACCEPTED)
async def create_var_code(request:schemas.verify_email,db: Session = Depends(get_db)):
    return await user_repository.ver_email(request,db)



