from fastapi import FastAPI,Depends,status,Response,HTTPException,APIRouter
from fastapi.responses import FileResponse

from ..app import models, oath2
from ..app import schemas
from ..app.database import engine,SessionLocal,get_db
from sqlalchemy.orm import Session
from typing import List
from ..repository import blog_repository

router=APIRouter(
    tags=["blog"],
    prefix="/blog"
)



@router.get("/{id}",status_code=status.HTTP_200_OK,response_model=schemas.ShowBlog)
def show(id: int,db: Session = Depends(get_db),current_user:models.User=Depends(oath2.get_current_user)):
   return blog_repository.get_blog(id,db)


@router.get("/",response_model=schemas.BlogResponse)
def all(limit: int = 4, skip: int = 0,db: Session = Depends(get_db),q: str | None = None):
    return blog_repository.all_blog(limit, skip, db,q)

@router.post("/",status_code=status.HTTP_201_CREATED)
def create(request:schemas.Blog,db: Session = Depends(get_db),current_user:models.User=Depends(oath2.get_current_user)):
    return blog_repository.create_blog(request,db,current_user)
  

    
@router.delete("/{id}",status_code=status.HTTP_204_NO_CONTENT)
def destroy(id: int,db: Session = Depends(get_db),current_user:models.User=Depends(oath2.get_current_user)):
    return blog_repository.destroy(id,db,current_user)
    


@router.put("/{id}",status_code=status.HTTP_202_ACCEPTED)
def update(id: int,request:schemas.Blog,db: Session = Depends(get_db),current_user:models.User=Depends(oath2.get_current_user)):
    return blog_repository.update(id,request,db,current_user) 

