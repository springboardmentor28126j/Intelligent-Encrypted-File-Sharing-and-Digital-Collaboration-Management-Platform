from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.files import router as files_router
from app.api.folders import router as folders_router
from app.api.monitoring import router as monitoring_router
from app.api.shares import router as shares_router
from app.core.config import settings
from app.core.database import check_database
from app.core.mongodb import check_mongodb
from app.core.redis import check_redis
from app.services.file_utils import (
    ensure_storage_directory,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_storage_directory()
    yield

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "TrustShare - Secure encrypted "
        "file sharing and collaboration platform"
    ),
    lifespan=lifespan,
)


# =========================================================
# CORS
# =========================================================

#app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# ROUTERS
# =========================================================

app.include_router(auth_router)
app.include_router(files_router)
app.include_router(folders_router)
app.include_router(shares_router)
app.include_router(monitoring_router)


# =========================================================
# ROOT
# =========================================================

@app.get("/")
def root():

    return {
        "application": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
    }


# =========================================================
# HEALTH
# =========================================================


@app.get("/health/live")
def health_live():
    return {"status": "alive", "application": settings.APP_NAME, "version": settings.APP_VERSION}

@app.get("/health")
def health():

    return {
        "status": "healthy",
        "database": check_database(),
        "mongodb": check_mongodb(),
        "redis": check_redis(),
    }


@app.get("/health/db")
def health_db():

    healthy = check_database()

    return {
        "service": "postgresql",
        "status": (
            "healthy"
            if healthy
            else "unhealthy"
        ),
    }


@app.get("/health/mongodb")
def health_mongodb():

    healthy = check_mongodb()

    return {
        "service": "mongodb",
        "status": (
            "healthy"
            if healthy
            else "unhealthy"
        ),
    }


@app.get("/health/redis")
def health_redis():

    healthy = check_redis()

    return {
        "service": "redis",
        "status": (
            "healthy"
            if healthy
            else "unhealthy"
        ),
    }