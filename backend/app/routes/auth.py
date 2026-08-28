from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.db.database import get_db
from app.db.models import User
from app.schemas.user import (
    SendRegisterOTPRequest, VerifyRegisterRequest, UserOut, 
    UserLogin, Token, ForgotPasswordRequest, ResetPasswordOTPRequest
)
from app.core.security import get_password_hash, verify_password, create_access_token, generate_otp
from app.core.email import send_otp_email, send_registration_otp_email

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/send-register-otp")
def send_register_otp(request: SendRegisterOTPRequest, db: Session = Depends(get_db)):
    # Check if email is already registered
    db_user = db.query(User).filter(User.email == request.email).first()
    if db_user and db_user.hashed_password:
        raise HTTPException(status_code=400, detail="Email is already registered")

    otp = generate_otp()
    
    if db_user:
        # Update existing unverified entry
        db_user.reset_otp = otp
        db_user.otp_expiry = datetime.utcnow() + timedelta(minutes=10)
    else:
        # Create temporary user entry for holding OTP
        db_user = User(
            name="Pending User",
            email=request.email,
            hashed_password="PENDING_VERIFICATION",
            reset_otp=otp,
            otp_expiry=datetime.utcnow() + timedelta(minutes=10)
        )
        db.add(db_user)

    db.commit()

    email_sent = send_registration_otp_email(request.email, otp)
    if not email_sent:
        raise HTTPException(status_code=500, detail="Failed to send OTP email")

    return {"message": "Verification OTP sent to your email"}

@router.post("/verify-and-register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def verify_and_register(request: VerifyRegisterRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()
    
    if not user or user.reset_otp is None:
        raise HTTPException(status_code=400, detail="Please request an OTP first")

    if user.reset_otp != request.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    if user.otp_expiry is None or datetime.utcnow() > user.otp_expiry:
        raise HTTPException(status_code=400, detail="OTP has expired")

    # OTP is valid -> Finalize Registration
    user.name = request.name
    user.hashed_password = get_password_hash(request.password)
    user.reset_otp = None
    user.otp_expiry = None
    
    db.commit()
    db.refresh(user)
    return user

@router.post("/login", response_model=Token)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_data.email).first()
    if not user or user.hashed_password == "PENDING_VERIFICATION" or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/send-otp")
def send_otp(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()
    if not user or user.hashed_password == "PENDING_VERIFICATION":
        raise HTTPException(status_code=404, detail="Email not registered")
    
    otp = generate_otp()
    user.reset_otp = otp
    user.otp_expiry = datetime.utcnow() + timedelta(minutes=10)
    db.commit()
    
    email_sent = send_otp_email(request.email, otp)
    if not email_sent:
        raise HTTPException(status_code=500, detail="Failed to send email")

    return {"message": "OTP sent successfully to your email"}

@router.post("/reset-password-otp")
def reset_password_otp(request: ResetPasswordOTPRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.reset_otp != request.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
        
    if user.otp_expiry is None or datetime.utcnow() > user.otp_expiry:
        raise HTTPException(status_code=400, detail="OTP has expired")
        
    user.hashed_password = get_password_hash(request.new_password)
    user.reset_otp = None
    user.otp_expiry = None
    db.commit()
    
    return {"message": "Password reset successful"}