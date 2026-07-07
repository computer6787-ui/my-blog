from fastapi import FastAPI,Depends,status,Response,HTTPException,APIRouter
from fastapi.responses import FileResponse
from .. import schemas,models,oath2
from ..database import engine,SessionLocal,get_db
from sqlalchemy.orm import session
from typing import List
from ..repository import blog_func

router=APIRouter(
    tags=["blog"],
    prefix="/blog"
)



@router.get("/{id}",status_code=status.HTTP_200_OK,response_model=schemas.ShowBlog)
def show(id,db:session=Depends(get_db),current_user:schemas.User=Depends(oath2.get_current_user)):
   return blog_func.get_blog(id,db,current_user)


@router.get("/",response_model=list[schemas.ShowBlog])
def all(limit: int = 4, skip: int = 0,db:session=Depends(get_db)):
    return blog_func.all_blog(limit, skip, db)

@router.post("/",status_code=status.HTTP_201_CREATED)
def create(request:schemas.Blog,db:session=Depends(get_db),current_user:schemas.User=Depends(oath2.get_current_user)):
    return blog_func.create_blog(request,db,current_user)


    
@router.delete("/{id}",status_code=status.HTTP_204_NO_CONTENT)
def destroy(id,db:session=Depends(get_db),current_user:schemas.User=Depends(oath2.get_current_user)):
    return blog_func.destroy(id,db,current_user)
    


@router.put("/{id}",status_code=status.HTTP_202_ACCEPTED)
def update(id,request:schemas.Blog,db:session=Depends(get_db),current_user:schemas.User=Depends(oath2.get_current_user)):
    return blog_func.update(id,request,db,current_user) 

