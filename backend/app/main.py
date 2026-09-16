from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import Base, engine, ensure_file_storage_columns, ensure_user_mfa_columns
from . import models
from .routers import activity, auth, dashboard, files, folders, secure_share_links, shares, users
from .redis_client import redis_conn

Base.metadata.create_all(bind=engine)
ensure_file_storage_columns()
ensure_user_mfa_columns()
app = FastAPI(title="TrustShare API", description="Milestone 1 secure file-sharing API")
app.add_middleware(CORSMiddleware, allow_origins=[settings.frontend_origin], allow_credentials=True, allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"], allow_headers=["Authorization", "Content-Type"])
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(folders.router)
app.include_router(files.router)
app.include_router(shares.router)
app.include_router(secure_share_links.router)
app.include_router(activity.router)
app.include_router(dashboard.router)


@app.get("/api/health", tags=["System"])
def health():
    return {"status": "ok", "service": "TrustShare API"}
