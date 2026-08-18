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

    try:
        await send_verification_email(
            request.email,
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








def edit_user(request,db,current_user):
    User=db.query(models.User).filter(models.User.id==current_user.id).first()
    if not User:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail=f"user with the id {id} is not available")
    User.name=request.name
    db.commit()
    db.refresh(User)
    return User



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
        await send_verification_email(
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