import os
import re
import time
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt

from database import Base, engine, SessionLocal
import models

from auth import router as auth_router
from files import router as files_router
from monitoring import router as monitoring_router


load_dotenv()


SECRET_KEY = os.getenv(
    "TRUSTSHARE_JWT_SECRET_KEY"
)

ALGORITHM = "HS256"


# ============================================================
# DATABASE
# ============================================================

Base.metadata.create_all(bind=engine)


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="TrustShare API",
    description="Secure File Sharing and Digital Collaboration Platform",
    version="1.0.0",
)


# ============================================================
# CORS
# ============================================================

cors_origins_raw = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:5174,http://localhost:5175",
)

CORS_ORIGINS = [
    origin.strip()
    for origin in cors_origins_raw.split(",")
    if origin.strip()
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# DETECT ACTIVITY TYPE
# ============================================================

def detect_action(method: str, path: str) -> str:

    if path == "/auth/register" and method == "POST":
        return "register"

    if path == "/auth/login" and method == "POST":
        return "login"

    if path.startswith("/auth/"):
        return "authentication"

    if path.endswith("/rotate-key") and method == "POST":
        return "key_rotation"

    if "/download" in path and method == "GET":
        return "download"

    if path == "/files/upload" and method == "POST":
        return "upload"

    if path == "/files/share" and method == "POST":
        return "share"

    if path.startswith("/files/share/") and method == "DELETE":
        return "revoke_share"

    if path == "/files/temporary-link" and method == "POST":
        return "temporary_link_create"

    if path.startswith("/files/temporary/") and method == "GET":
        return "temporary_download"

    if path.startswith("/files/") and method == "DELETE":
        return "delete_file"

    if path.startswith("/files/") and method == "GET":
        return "file_access"

    if path.startswith("/monitoring/"):
        return "monitoring_request"

    return "api_request"


# ============================================================
# REMOVE SENSITIVE TEMPORARY-LINK TOKENS
# ============================================================

def sanitize_path(path: str) -> str:

    return re.sub(
        r"(/files/temporary/)[^/]+",
        r"\1[REDACTED]",
        path,
    )


# ============================================================
# READ USER FROM JWT
# ============================================================

def get_user_from_token(request: Request):

    if not SECRET_KEY:
        return None, None

    authorization = request.headers.get(
        "Authorization"
    )

    if not authorization:
        return None, None

    if not authorization.lower().startswith("bearer "):
        return None, None

    token = authorization.split(
        " ",
        1
    )[1].strip()

    if not token:
        return None, None

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )

        user_id = payload.get("sub")
        user_email = payload.get("email")

        return user_id, user_email

    except Exception:

        return None, None


# ============================================================
# ACTIVITY MONITORING MIDDLEWARE
# ============================================================

@app.middleware("http")
async def activity_monitoring_middleware(
    request: Request,
    call_next,
):

    start_time = time.perf_counter()

    status_code = 500

    try:

        response = await call_next(request)

        status_code = response.status_code

        return response

    except Exception:

        status_code = 500

        raise

    finally:

        try:

            original_path = request.url.path

            # Don't log monitoring endpoints themselves.
            # This prevents monitoring from generating
            # unnecessary monitoring records.

            should_log = not (
                original_path.startswith("/monitoring/")
                or original_path in [
                    "/health",
                    "/docs",
                    "/openapi.json",
                    "/redoc",
                ]
            )

            if not should_log:
                continue_logging = False
            else:
                continue_logging = True

            if continue_logging:

                elapsed_ms = int(
                    (
                        time.perf_counter()
                        - start_time
                    ) * 1000
                )

                method = request.method

                sanitized_path = sanitize_path(
                    original_path
                )

                action = detect_action(
                    method,
                    original_path,
                )

                user_id, user_email = (
                    get_user_from_token(request)
                )

                client_ip = None

                if request.client:
                    client_ip = request.client.host

                db = SessionLocal()

                try:

                    activity = models.ActivityLog(
                        user_id=user_id,
                        user_email=user_email,
                        action=action,
                        method=method,
                        path=sanitized_path,
                        status_code=status_code,
                        ip_address=client_ip,
                        response_time_ms=elapsed_ms,
                        created_at=datetime.utcnow(),
                    )

                    db.add(activity)

                    db.commit()

                except Exception:

                    db.rollback()

                finally:

                    db.close()

        except Exception:

            # Monitoring must never break
            # the actual API request.
            pass


# ============================================================
# ROUTERS
# ============================================================

app.include_router(auth_router)

app.include_router(files_router)

app.include_router(monitoring_router)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "message": "TrustShare API is running",
        "status": "success",
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health_check():

    return {
        "status": "healthy",
        "service": "TrustShare Backend",
    }


# ============================================================
# API INFORMATION
# ============================================================

@app.get("/api")
def api_info():

    return {
        "application": "TrustShare",
        "version": "1.0.0",
        "status": "online",
    }