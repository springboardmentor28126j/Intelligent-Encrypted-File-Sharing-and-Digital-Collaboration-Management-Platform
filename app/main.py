from fastapi import FastAPI, HTTPException, status
from pymongo.errors import PyMongoError
from redis.exceptions import RedisError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.auth import router as auth_router
from app.api.files import router as files_router
from app.api.folders import router as folders_router
from app.core.database import Base, engine
from app.core.mongodb import get_mongo_db
from app.core.redis import get_redis
from app.models.file import File, Folder
from app.models.user import User

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="TrustShare API",
    version="1.0.0"
)

app.include_router(auth_router)
app.include_router(files_router)
app.include_router(folders_router)

@app.get("/")
def root():
    return {
        "message": "TrustShare API is running"
    }


@app.get("/health/db")
def database_health():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return {
            "status": "healthy",
            "database": "PostgreSQL"
        }
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "status": "unhealthy",
                "database": "PostgreSQL",
                "error": str(e),
            },
        )


@app.get("/health/mongodb")
def mongodb_health():
    try:
        db = get_mongo_db()
        db.command("ping")

        return {
            "status": "healthy",
            "database": "MongoDB"
        }

    except PyMongoError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "status": "unhealthy",
                "database": "MongoDB",
                "error": str(e),
            },
        )


@app.get("/health/redis")
def redis_health():
    try:
        client = get_redis()
        client.ping()

        return {
            "status": "healthy",
            "database": "Redis"
        }

    except RedisError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "status": "unhealthy",
                "database": "Redis",
                "error": str(e),
            },
        )