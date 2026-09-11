from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uuid
import time
from src.core.config import settings
from src.core.logging import setup_logging, logger, correlation_id_ctx
from src.api.router import api_router
from src.models.sql.database import engine, Base
import src.models.sql.user  # noqa: F401
import src.models.sql.file  # noqa: F401
import src.models.sql.share  # noqa: F401

setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing TrustShare platform...")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Platform database tables initialized successfully.")
    except Exception as e:
        logger.warning(f"Could not auto-create database tables on startup: {e}")
    yield
    logger.info("Shutting down TrustShare platform...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r"^https?:\/\/.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    corr_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
    correlation_id_ctx.set(corr_id)
    start_time = time.time()
    
    response = await call_next(request)
    
    process_time = (time.time() - start_time) * 1000
    response.headers["X-Correlation-ID"] = corr_id
    response.headers["X-Process-Time-Ms"] = f"{process_time:.2f}"
    return response

@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION
    }

app.include_router(api_router, prefix=settings.API_V1_STR)
