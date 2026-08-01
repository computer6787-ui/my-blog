from datetime import timedelta, datetime, timezone
from apscheduler.schedulers.background import BackgroundScheduler
from backend.app import models
from fastapi import Depends, status,HTTPException
from backend.app.database import get_db
from backend.app.encryption import Encrypting
from backend.utils.varification import generate_verification_code
from backend.utils.mail import send_verification_email



scheduler = BackgroundScheduler()



async def create_pending_user(request, db):
    verification_code = generate_verification_code()

    new_pending_user = models.PendingUser(
        name=request.name,
        email=request.email,
        hashed_password=Encrypting.bcrypt(request.password),
        verification_code=verification_code,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10)
    )

    db.add(new_pending_user)
    db.commit()
    db.refresh(new_pending_user)

    await send_verification_email(
        request.email,
        verification_code
    )

    return new_pending_user

def show_user(id:int,db):
    user=db.query(models.User).filter(models.User.id==id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail=f"User with the id {id} is not available")
    return user

async def verify_pending_user(request, db):

    pending_user = db.query(models.PendingUser).filter(
        models.PendingUser.email == request.email
    ).first()

    if not pending_user:
        raise HTTPException(
            status_code=404,
            detail="Pending user not found"
        )

    if pending_user.verification_code != request.verification_code:
        raise HTTPException(
            status_code=400,
            detail="Invalid verification code"
        )

    if pending_user.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=400,
            detail="Verification code expired"
        )


    # Create real user
    new_user = models.User(
        name=pending_user.name,
        email=pending_user.email,
        hashed_password=pending_user.hashed_password
    )

    db.add(new_user)

    # Remove pending user
    db.delete(pending_user)

    db.commit()
    db.refresh(new_user)

    return new_user 

from backend.app.database import SessionLocal
from datetime import datetime, timezone

def delete_expired_pending_users():
    db = SessionLocal()
    try:
        db.query(models.PendingUser).filter(
            models.PendingUser.expires_at < datetime.now(timezone.utc)
        ).delete(synchronize_session=False)

        db.commit()
    finally:
        db.close()
scheduler.add_job(delete_expired_pending_users, "interval", minutes=10)
scheduler.start()