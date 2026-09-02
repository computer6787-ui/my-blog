
import os
import secrets
import requests as http_requests
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from ..app import models
from backend.app.oath2 import get_current_user
from backend.app.token import create_access_token
from ..app import schemas
from ..app.encryption import Encrypting
from ..app.database import get_db
from sqlalchemy.orm import Session
from dotenv import load_dotenv

load_dotenv()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")


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


@router.get("/auth/google/config")
async def google_config():
    """Return the Google Client ID for the frontend."""
    return {"client_id": GOOGLE_CLIENT_ID}


@router.post("/auth/google", response_model=schemas.Token)
async def google_auth(
    request: Request,
    db: Session = Depends(get_db)
):
    """Authenticate or register a user via Google Identity Services."""
    if not GOOGLE_CLIENT_ID or GOOGLE_CLIENT_ID == "YOUR_GOOGLE_CLIENT_ID_HERE":
        raise HTTPException(
            status_code=503,
            detail="Google Sign-In is not configured. Please set GOOGLE_CLIENT_ID."
        )

    data = await request.json()
    credential = data.get("credential")

    if not credential:
        raise HTTPException(
            status_code=422,
            detail="Google credential is required"
        )

    # Verify the token with Google's tokeninfo endpoint
    try:
        token_info_resp = http_requests.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": credential},
            timeout=10
        )
        if token_info_resp.status_code != 200:
            raise HTTPException(
                status_code=401,
                detail="Invalid Google token"
            )
        token_data = token_info_resp.json()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Could not verify Google token"
        )

    # Validate that the token was issued for our client
    aud = token_data.get("aud", "")
    if aud != GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=401,
            detail="Google token was not issued for this application"
        )

    google_email = token_data.get("email")
    google_name = token_data.get("name", "")
    google_picture = token_data.get("picture", "")

    if not google_email:
        raise HTTPException(
            status_code=401,
            detail="Could not extract email from Google token"
        )

    # Find existing user by email
    normalized_email = google_email.strip().lower()
    user = db.query(models.User).filter(
        models.User.email.ilike(normalized_email)
    ).first()

    if not user:
        # Create a new user — random password since they use Google to sign in
        random_password = secrets.token_urlsafe(32)
        user = models.User(
            name=google_name or normalized_email.split("@")[0],
            email=normalized_email,
            hashed_password=Encrypting.bcrypt(random_password),
            profile_picture_url=google_picture or None
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    access_token = create_access_token(
        data={"sub": user.email}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }
