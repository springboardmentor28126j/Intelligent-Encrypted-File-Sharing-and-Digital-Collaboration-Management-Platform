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
from app.database import Base, engine
from app.mongodb import init_mongo_indexes
from app.routers import auth as auth_router
from app.routers import files as files_router
from app.routers import health as health_router
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
    - Creates SQL tables (PostgreSQL/SQLite)
    - Initializes local secure upload directory
    - Creates MongoDB indexes
    """
    logger.info("Initializing TrustShare backend services...")
    # SQL Database tables
    Base.metadata.create_all(bind=engine)
    # File storage directory
    ensure_upload_dir()
    # MongoDB indexes
    init_mongo_indexes()
    logger.info("TrustShare services initialized successfully.")
    yield
    logger.info("TrustShare backend services shutting down.")


# ─── App Instance ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="TrustShare API",
    description="Enterprise Secure File Sharing System API with MongoDB & Redis integration.",
    version="1.0.0",
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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth_router.router)
app.include_router(health_router.router)
app.include_router(files_router.router)
app.include_router(shares_router.router)
