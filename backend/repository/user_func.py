from backend import models
from fastapi import status,Response,HTTPException
from backend.encryption import Encrypting


def create_user(request,db):
    print(request.password)
    new_user=models.User(name=request.name,email=request.email,password=Encrypting.bcrypt(request.password))
    db.add(new_user)
    db.commit() 
    db.refresh(new_user) 
    return new_user 


def show_user(id:int,db):
    user=db.query(models.User).filter(models.User.id==id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail=f"User with the id {id} is not available")
    return user