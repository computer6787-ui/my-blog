from datetime import timedelta, datetime, timezone
from apscheduler.schedulers.background import BackgroundScheduler
from backend.app import models
from fastapi import Depends, status,HTTPException
from backend.app.database import get_db
from backend.app.encryption import Encrypting
from backend.utils.varification import generate_verification_code
from backend.utils.mail import send_verification_email, send_password_reset_email



scheduler = BackgroundScheduler()



async def create_pending_user(request, db):
    normalized_email = (request.email or "").strip().lower()
    if not normalized_email:
        raise HTTPException(status_code=400, detail="Email is required")

    existing_user = db.query(models.User).filter(models.User.email.ilike(normalized_email)).first()
    if existing_user:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    existing_pending = db.query(models.PendingUser).filter(models.PendingUser.email.ilike(normalized_email)).first()
    if existing_pending:
        raise HTTPException(status_code=409, detail="Verification is already pending for this email")

    verification_code = generate_verification_code()

    new_pending_user = models.PendingUser(
        name=request.name,
        email=normalized_email,
        hashed_password=Encrypting.bcrypt(request.password),
        verification_code=verification_code,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10)
    )

    try:
        await send_verification_email(
            normalized_email,
            verification_code
        )

        db.add(new_pending_user)
        db.commit()
        db.refresh(new_pending_user)
        return new_pending_user

    except Exception:
        db.rollback()
        raise

def show_user(id:int,db):
    user=db.query(models.User).filter(models.User.id==id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail=f"User with the id {id} is not available")
    return user

async def verify_pending_user(request, db):
    normalized_email = (request.email or "").strip().lower()

    pending_user = db.query(models.PendingUser).filter(
        models.PendingUser.email.ilike(normalized_email)
    ).first()

    if not pending_user:
        raise HTTPException(
            status_code=404,
            detail="Pending user not found"
        )

    if db.query(models.User).filter(models.User.email.ilike(normalized_email)).first():
        raise HTTPException(
            status_code=409,
            detail="This email is already registered"
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
        email=normalized_email,
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








def edit_user(request,db,current_user):
    User=db.query(models.User).filter(models.User.id==current_user.id).first()
    if not User:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail=f"user with the id {id} is not available")
    User.name=request.name
    db.commit()
    db.refresh(User)
    return User


def edit_user_profile(request, db, current_user):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if request.name is not None:
        cleaned_name = (request.name or "").strip()
        if cleaned_name:
            user.name = cleaned_name

    if request.bio is not None:
        user.bio = (request.bio or "").strip()[:500]

    if request.profile_picture_url is not None:
        user.profile_picture_url = (request.profile_picture_url or "").strip() or None

    if request.location is not None:
        user.location = (request.location or "").strip()[:150] or None

    if request.hobby is not None:
        user.hobby = (request.hobby or "").strip()[:150] or None

    if request.occupation is not None:
        user.occupation = (request.occupation or "").strip()[:150] or None

    if request.education is not None:
        user.education = (request.education or "").strip()[:150] or None

    if request.facebook is not None:
        user.facebook = (request.facebook or "").strip()[:255] or None

    if request.instagram is not None:
        user.instagram = (request.instagram or "").strip()[:255] or None

    db.commit()
    db.refresh(user)
    return user



async def ver_email(request,db):
    user=db.query(models.User).filter(models.User.email==request.email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail=f"user with the email {id} is not available")
    
    verification_code = generate_verification_code()
    print(verification_code)
    
    ver_code = models.passward_varification(
            email=request.email,
            verification_code=verification_code,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=10)
        )
    try:
            await send_password_reset_email(
                request.email,
                verification_code
            )
            db.add(ver_code)
            db.commit()
            db.refresh(ver_code)
            return ver_code


    except Exception:
            db.rollback()
            raise


def delete_expired_code():
    db = SessionLocal()
    try:
        db.query(models.passward_varification).filter(
            models.passward_varification.expires_at < datetime.now(timezone.utc)
        ).delete(synchronize_session=False)

        db.commit()
    finally:
        db.close()
scheduler.add_job(delete_expired_code, "interval", minutes=10)

def delete_used_code(email):
    db = SessionLocal()
    try:
        db.query(models.passward_varification).filter(
            models.passward_varification.email == email
        ).delete(synchronize_session=False) 
        db.commit()
    finally:
        db.close()


async def verify_user(request,db):
    ver_code = db.query(models.passward_varification).filter(
    models.passward_varification.email == request.email
    ).first()

    if not ver_code:
        raise HTTPException(
            status_code=404,
            detail="code not found"
        )

    if ver_code.verification_code != request.verification_code:
        raise HTTPException(
            status_code=400,
            detail="Invalid verification code"
        )

    if ver_code.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=400,
            detail="Verification code expired"
        )
    ver_code.verified=True
    db.commit()
    
    return {"verified":True}


async def resend_verification_code(request, db):
    email = (request.email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    pending_user = db.query(models.PendingUser).filter(models.PendingUser.email == email).first()
    if pending_user:
        new_code = generate_verification_code()
        pending_user.verification_code = new_code
        pending_user.expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
        try:
            await send_verification_email(email, new_code)
            db.commit()
            return {"message": "Verification code resent successfully"}
        except Exception:
            db.rollback()
            raise HTTPException(status_code=500, detail="Could not resend verification code")

    reset_record = db.query(models.passward_varification).filter(models.passward_varification.email == email).first()
    if reset_record:
        new_code = generate_verification_code()
        reset_record.verification_code = new_code
        reset_record.expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
        reset_record.verified = False
        try:
            await send_password_reset_email(email, new_code)
            db.commit()
            return {"message": "Password reset code resent successfully"}
        except Exception:
            db.rollback()
            raise HTTPException(status_code=500, detail="Could not resend password reset code")

    raise HTTPException(status_code=404, detail="No pending verification was found for this email")


async def update_pass(request, db):

    user = db.query(models.User).filter(
        models.User.email == request.email
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    ver_code = db.query(models.passward_varification).filter(
        models.passward_varification.email == request.email
    ).first()

    if not ver_code:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verification record not found"
        )

    if not ver_code.verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification required"
        )

    user.hashed_password = Encrypting.bcrypt(request.new_password)

    ver_code.verified = False

    db.commit()
    delete_used_code(request.email)
    return {"message": "Password updated successfully"}