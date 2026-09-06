from fastapi import FastAPI,Depends,status,Response,HTTPException,APIRouter, File, UploadFile
from typing import cast

from ..app import models
from ..app.encryption import Encrypting
from ..app import schemas
from ..app.database import engine,SessionLocal,get_db
from ..app.config import MAIN_ADMIN_EMAIL, MAX_IMAGE_UPLOAD_BYTES
from sqlalchemy.orm import Session
from ..repository import user_repository
from ..app import oath2
from ..app import supabase_storage


router=APIRouter(
    tags=["user"],
    prefix="/user"
)

ALLOWED_IMAGE_CONTENT_TYPES = {
    "image/webp",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
}


@router.post("/upload-avatar", status_code=status.HTTP_201_CREATED)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: models.User = Depends(oath2.get_current_user),
):
    """
    Accept a profile avatar image, validate size/type, stream it to Supabase Storage
    using the server-side service_role key. Returns the public Storage URL to be
    stored in users.profile_picture_url.

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
            detail="Avatar must be WebP, JPEG, PNG, or GIF.",
        )

    data = await file.read()
    file_size = len(data)
    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )
    if file_size > MAX_IMAGE_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image exceeds the {MAX_IMAGE_UPLOAD_BYTES // (1024 * 1024)} MB limit.",
        )

    try:
        public_url = await supabase_storage.upload_blog_image(
            user_id=cast(int, current_user.id),
            file_bytes=data,
            original_filename=file.filename or "avatar.webp",
            content_type=content_type,
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to upload avatar to storage. Please try again later.",
        )

    return {"url": public_url}


@router.post("/")
async def create_pending_user(request:schemas.User,db: Session = Depends(get_db)):
    return await user_repository.create_pending_user(request,db)

@router.get("/me", response_model=schemas.Show_user)
def me(current_user: models.User = Depends(oath2.get_current_user)):
    data = schemas.Show_user.model_validate(current_user)
    data.is_owner = current_user.email.lower() == MAIN_ADMIN_EMAIL.lower()
    return data

@router.get("/search", response_model=list[schemas.Show_user])
def search_users(q: str, db: Session = Depends(get_db), limit: int = 8):
    query = (q or "").strip()
    if not query:
        return []
    users = db.query(models.User).filter(
        models.User.name.ilike(f"%{query}%")
    ).limit(min(limit, 20)).all()
    return users

@router.get("/{id}",response_model=schemas.Show_user)
def show_user(id: int, db: Session = Depends(get_db)):
    return user_repository.show_user(id,db) 

@router.put("/edit_name",status_code=status.HTTP_202_ACCEPTED)
def update(request:schemas.edit_user,db: Session = Depends(get_db),current_user:models.User=Depends(oath2.get_current_user)):
    return user_repository.edit_user(request,db,current_user)

@router.put("/edit_profile",status_code=status.HTTP_202_ACCEPTED)
def update_profile(request:schemas.UserProfileEdit,db: Session = Depends(get_db),current_user:models.User=Depends(oath2.get_current_user)):
    return user_repository.edit_user_profile(request,db,current_user)

@router.put("/edit_pass",status_code=status.HTTP_202_ACCEPTED)
async def update_pass(request:schemas.Update_password,db: Session = Depends(get_db)):
    return await user_repository.update_pass(request,db)

@router.post("/ver_email",status_code=status.HTTP_202_ACCEPTED)
async def create_var_code(request:schemas.verify_email,db: Session = Depends(get_db)):
    return await user_repository.ver_email(request,db)



