from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import session
from ..app import schemas
from ..app.database import get_db
from ..repository import user_repository


router=APIRouter(
    tags=["validation"]
)


@router.post("/verify")
async def verify_user(request: schemas.VerifyUser, db: session = Depends(get_db)):
    return await user_repository.verify_pending_user(request, db)

@router.post("/verify_user") 
async def varify_user(request:schemas.VerifyUser,db:session=Depends(get_db)):
    return await user_repository.verify_user(request,db)

