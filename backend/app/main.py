"""
main.py – FastAPI application entry point.

Configures:
  - CORS middleware (Next.js frontend on localhost:3000)
  - API routers:
      • /register, /login, /logout, /me (Authentication)
      • /health, /health/mongodb, /health/redis (System Health)
      • /files (Secure File Upload, Listing, Download, Delete, Share)
      • /share (Public Link Access & Download)
  - Database initialization & MongoDB index setup in lifespan
"""

from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine, is_sqlite
from app.mongodb import init_mongo_indexes
from app.routers import auth as auth_router
from app.routers import audit as audit_router
from app.routers import analytics as analytics_router
from app.routers import files as files_router
from app.routers import health as health_router
from app.routers import notifications as notifications_router
from app.routers import shares as shares_router
from app.services.file_service import ensure_upload_dir

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("trustshare.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler.
    - Creates SQL tables (for local SQLite)
    - Initializes local secure upload directory
    - Non-blocking MongoDB index setup
    """
    logger.info("Initializing TrustShare backend services...")
    # SQL Database tables
    if is_sqlite:
        try:
            Base.metadata.create_all(bind=engine)
            logger.info("SQLite local database schema verified.")
        except Exception as exc:
            logger.warning(f"Database schema auto-creation note: {exc}")
    else:
        logger.info("PostgreSQL database connection active.")

    # File storage directory
    try:
        ensure_upload_dir()
    except Exception as exc:
        logger.warning(f"Upload directory initialization note: {exc}")

    # MongoDB indexes
    try:
        init_mongo_indexes()
    except Exception as exc:
        logger.warning(f"MongoDB index initialization note: {exc}")

    logger.info("TrustShare services initialized successfully.")
    yield
    logger.info("TrustShare backend services shutting down.")


# ─── App Instance ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="TrustShare API",
    description="Enterprise Secure File Sharing System API with S3, Monitoring, Notifications, and Analytics.",
    version="2.0.0",
    docs_url="/docs",       # Swagger UI
    redoc_url="/redoc",     # ReDoc
    lifespan=lifespan,
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
cors_origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]
if not cors_origins:
    cors_origins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth_router.router)
app.include_router(health_router.router)
app.include_router(files_router.router)
app.include_router(shares_router.router)
app.include_router(audit_router.router)
app.include_router(notifications_router.router)
app.include_router(analytics_router.router)


# ─── Root Status Endpoint ─────────────────────────────────────────────────────
@app.get("/", tags=["System"])
def root():
    """Root health and status endpoint."""
    return {
        "status": "online",
        "service": "TrustShare API",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/health",
    }


# Forward /upload to /files/upload for legacy/short URI compatibility
@app.post("/upload", tags=["Files"], include_in_schema=False)
async def upload_file_alias(
    request: files_router.Request,
    file: files_router.UploadFile = files_router.File(...),
    description: files_router.Optional[str] = files_router.Form(None),
    current_user: files_router.User = files_router.Depends(files_router.get_current_user),
    db: files_router.Session = files_router.Depends(files_router.get_db),
):
    return await files_router.upload_file(
        request=request,
        file=file,
        description=description,
        current_user=current_user,
        db=db,
    )


