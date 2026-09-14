from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine
import models

from auth import router as auth_router
from files import router as files_router


# ============================================================
# DATABASE
# ============================================================

# Create all database tables
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# AUTHENTICATION ROUTES
# ============================================================

app.include_router(auth_router)


# ============================================================
# FILE ROUTES
# ============================================================

app.include_router(files_router)


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
# HEALTH CHECK
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