
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from ..app import models
from backend.app.oath2 import get_current_user
from backend.app.token import create_access_token
from ..app import schemas
from ..app.encryption import Encrypting
from ..app.database import get_db
from sqlalchemy.orm import Session



router=APIRouter(
    tags=["auth"]
) 

 
@router.post("/login", response_model=schemas.Token)
async def login(
    request: Request,
    db: Session = Depends(get_db)
):
    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        data = await request.json()
        username = data.get("username")
        password = data.get("password")

    elif "application/x-www-form-urlencoded" in content_type:
        form = await request.form()
        username = form.get("username")
        password = form.get("password")

    else:
        raise HTTPException(
            status_code=415,
            detail="Unsupported content type"
        )

    if not username or not password:
        raise HTTPException(
            status_code=422,
            detail="Username and password are required"
        )

    user = db.query(models.User).filter(
        models.User.email == username
    ).first()

    if not user:
        raise HTTPException(
            status_code=400,
            detail="Invalid email or password"
        )

    if not Encrypting.Varify(
        password,
        user.hashed_password
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid email or password"
        )

    access_token = create_access_token(
        data={"sub": user.email}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }
