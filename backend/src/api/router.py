from fastapi import APIRouter
from src.api.v1 import auth, files, shares, audit, analytics

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(files.router)
api_router.include_router(shares.router)
api_router.include_router(audit.router)
api_router.include_router(analytics.router)
