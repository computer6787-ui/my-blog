from fastapi import FastAPI,Depends,status,Response,HTTPException,APIRouter, File, UploadFile
from fastapi.responses import FileResponse
from typing import cast

from ..app import models, oath2
from ..app import schemas
from ..app import config as app_config
from ..app import supabase_storage
from ..app.database import engine,SessionLocal,get_db
from sqlalchemy.orm import Session
from typing import List
from ..repository import blog_repository

router=APIRouter(
    tags=["blog"],
    prefix="/blog"
)

ALLOWED_IMAGE_CONTENT_TYPES = {
    "image/webp",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
}



@router.post("/upload-image", status_code=status.HTTP_201_CREATED)
async def upload_blog_image(
    file: UploadFile = File(...),
    current_user: models.User = Depends(oath2.get_current_user),
):
    """
    Accept a blog cover image (multipart form field name: `file`), validate
    size/type, then stream it to Supabase Storage using the server-side
    service_role key. Returns the public Storage URL — this URL (NOT the
    raw binary/base64) is what gets stored in blogs.image_url.

    Auth: JWT required (same local JWT as the rest of the API).
    """
    if not supabase_storage.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image storage is not configured on the server. Please contact the administrator.",
        )

    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Image must be WebP, JPEG, PNG, or GIF.",
        )

    data = await file.read()
    file_size = len(data)
    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )
    if file_size > app_config.MAX_IMAGE_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image exceeds the {app_config.MAX_IMAGE_UPLOAD_BYTES // (1024 * 1024)} MB limit.",
        )

    try:
        public_url = await supabase_storage.upload_blog_image(
            user_id=cast(int, current_user.id),
            file_bytes=data,
            original_filename=file.filename or "cover.webp",
            content_type=content_type,
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to upload image to storage. Please try again later.",
        )

    return {"url": public_url}



@router.get("/{id}",status_code=status.HTTP_200_OK,response_model=schemas.ShowBlog)
def show(id: int,db: Session = Depends(get_db),current_user:models.User=Depends(oath2.get_current_user)):
   return blog_repository.get_blog(id,db)


@router.get("/",response_model=schemas.BlogResponse)
def all(limit: int = 4, skip: int = 0, db: Session = Depends(get_db), q: str | None = None, category: str | None = None):
    return blog_repository.all_blog(limit, skip, db, q, category)

@router.post("/",status_code=status.HTTP_201_CREATED)
def create(request:schemas.Blog,db: Session = Depends(get_db),current_user:models.User=Depends(oath2.get_current_user)):
    return blog_repository.create_blog(request,db,current_user)
  

    
@router.delete("/{id}",status_code=status.HTTP_204_NO_CONTENT)
def destroy(id: int,db: Session = Depends(get_db),current_user:models.User=Depends(oath2.get_current_user)):
    return blog_repository.destroy(id,db,current_user)
    


@router.put("/{id}",status_code=status.HTTP_202_ACCEPTED)
def update(id: int,request:schemas.Blog,db: Session = Depends(get_db),current_user:models.User=Depends(oath2.get_current_user)):
    return blog_repository.update(id,request,db,current_user) 

