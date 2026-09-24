from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request
)

from fastapi.security import OAuth2PasswordRequestForm

from sqlalchemy.orm import Session

from database import SessionLocal
from models import User

from security import (
    hash_password,
    verify_password,
    create_access_token
)

from mongodb import (
    create_activity_log,
    create_security_alert
)


# ==========================================
# ROUTER
# ==========================================

router = APIRouter(
    tags=["Authentication"]
)


# ==========================================
# DATABASE
# ==========================================

def get_db():

    db = SessionLocal()

    try:

        yield db

    finally:

        db.close()


# ==========================================
# REGISTER
# ==========================================

@router.post("/register")
def register(

    name: str,

    email: str,

    password: str,

    db: Session = Depends(
        get_db
    )

):

    # ==========================================
    # CHECK IF EMAIL ALREADY EXISTS
    # ==========================================

    existing_user = (

        db.query(User)

        .filter(
            User.email == email
        )

        .first()

    )

    if existing_user:

        raise HTTPException(

            status_code=400,

            detail="Email already registered"

        )


    # ==========================================
    # HASH PASSWORD
    # ==========================================

    hashed_password = hash_password(
        password
    )


    # ==========================================
    # CREATE USER
    # ==========================================

    new_user = User(

        name=name,

        email=email,

        password=hashed_password,

        role="user"

    )

    db.add(new_user)

    db.commit()

    db.refresh(new_user)


    # ==========================================
    # RESPONSE
    # ==========================================

    return {

        "message":
            "Registration successful",

        "user_id":
            new_user.id,

        "name":
            new_user.name,

        "email":
            new_user.email

    }


# ==========================================
# LOGIN
# ==========================================

@router.post("/login")
def login(

    request: Request,

    form_data: OAuth2PasswordRequestForm = Depends(),

    db: Session = Depends(get_db)

):

    # ==========================================
    # GET CLIENT IP
    # ==========================================

    ip_address = request.client.host

    print(
        "LOGIN REQUEST IP:",
        ip_address
    )


    print(
        "LOGIN EMAIL:",
        form_data.username
    )


    # ==========================================
    # FIND USER BY EMAIL
    # ==========================================

    user = (

        db.query(User)

        .filter(
            User.email == form_data.username
        )

        .first()

    )


    # ==========================================
    # USER NOT FOUND
    # ==========================================

    if user is None:

        print(
            "USER NOT FOUND"
        )

        # --------------------------------------------------
        # We cannot create a user-specific security alert
        # here because there is no valid user_id.
        # --------------------------------------------------

        print(
            "Unknown email login attempt from IP:",
            ip_address
        )

        raise HTTPException(

            status_code=401,

            detail="Invalid email or password"

        )


    print(
        "USER FOUND:",
        user.id
    )


    # ==========================================
    # VERIFY PASSWORD
    # ==========================================

    try:

        password_valid = verify_password(

            form_data.password,

            user.password

        )

        print(
            "PASSWORD VALID:",
            password_valid
        )

    except Exception as error:

        print(
            "PASSWORD VERIFICATION ERROR:",
            repr(error)
        )

        raise HTTPException(

            status_code=500,

            detail="Password verification failed"

        )


    # ==========================================
    # INVALID PASSWORD
    # ==========================================

    if not password_valid:

        print(
            "FAILED LOGIN ATTEMPT"
        )

        # ==========================================
        # SAVE FAILED LOGIN ACTIVITY
        # ==========================================

        try:

            create_activity_log(

                user_id=user.id,

                action="login",

                status="failed",

                details=(
                    "Failed login attempt "
                    "due to invalid password"
                ),

                ip_address=ip_address

            )

            print(
                "Failed login activity "
                "saved to MongoDB."
            )

        except Exception as error:

            print(
                "MongoDB failed login activity "
                "log failed:",
                error
            )


        # ==========================================
        # SAVE FAILED LOGIN SECURITY ALERT
        # ==========================================

        try:

            create_security_alert(

                user_id=user.id,

                alert_type="failed_login",

                severity="high",

                message=(
                    "A failed login attempt "
                    "was detected."
                ),

                ip_address=ip_address

            )

            print(
                "Failed login security alert "
                "saved to MongoDB."
            )

        except Exception as error:

            print(
                "MongoDB failed login security "
                "alert failed:",
                error
            )


        # ==========================================
        # RETURN LOGIN ERROR
        # ==========================================

        raise HTTPException(

            status_code=401,

            detail="Invalid email or password"

        )


    # ==========================================
    # AUDIT LOG - SUCCESSFUL LOGIN
    # ==========================================

    try:

        create_activity_log(

            user_id=user.id,

            action="login",

            status="success",

            details=(
                "User logged in successfully"
            ),

            ip_address=ip_address

        )

        print(
            "Successful login activity "
            "saved to MongoDB."
        )

    except Exception as error:

        print(
            "MongoDB login activity "
            "log failed:",
            error
        )


    # ==========================================
    # CREATE JWT TOKEN
    # ==========================================

    access_token = create_access_token(

        {
            "user_id": user.id
        }

    )


    # ==========================================
    # LOGIN RESPONSE
    # ==========================================

    return {

        "message":
            "Login successful",

        "access_token":
            access_token,

        "token_type":
            "bearer",

        "user_id":
            user.id,

        "name":
            user.name,

        "email":
            user.email,

        "role":
            user.role

    }