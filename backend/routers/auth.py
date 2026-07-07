
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from backend.oath2 import get_current_user
from backend.token import create_access_token
from .. import schemas,models
from ..encryption import Encrypting
from ..database import get_db
from sqlalchemy.orm import session



router=APIRouter(
    tags=["auth"]
)

 
@router.post("/login",response_model=schemas.Token)
def login(request:schemas.Login,db:session=Depends(get_db)):
    user=db.query(models.User).filter(models.User.email==request.username).first()
    if not user:
        raise HTTPException(status_code=400,detail="Invalid email or password")
    if not Encrypting.Varify(request.password,user.password):
        raise HTTPException(status_code=400,detail="Invalid email or password")
    
    access_token = create_access_token(data={"sub": user.email})


    return {"access_token": access_token, "token_type": "bearer"}
