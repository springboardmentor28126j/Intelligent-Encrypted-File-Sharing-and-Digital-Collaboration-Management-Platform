"""
routers/health.py – Health-check and connectivity endpoints.

Routes:
  GET /health          – Complete system health (PostgreSQL, MongoDB, Redis)
  GET /health/mongodb  – Dedicated MongoDB connection & latency check
  GET /health/redis    – Dedicated Redis connection & latency check
"""

from datetime import datetime, timezone
import time
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.mongodb import check_mongo_health
from app.redis_client import check_redis_health
from app.schemas import HealthStatusOut, MongoHealthOut, RedisHealthOut

router = APIRouter(prefix="/health", tags=["Health"])


@router.get(
    "",
    response_model=HealthStatusOut,
    summary="Comprehensive system health check",
    description="Tests connectivity across PostgreSQL, MongoDB, and Redis.",
)
def get_system_health(db: Session = Depends(get_db)) -> HealthStatusOut:
    # 1. PostgreSQL Health Check
    pg_start = time.perf_counter()
    pg_status = "healthy"
    pg_connected = True
    try:
        db.execute(text("SELECT 1"))
        pg_latency = round((time.perf_counter() - pg_start) * 1000, 2)
    except Exception as exc:
        pg_status = "error"
        pg_connected = False
        pg_latency = round((time.perf_counter() - pg_start) * 1000, 2)

    # 2. MongoDB Health Check
    mongo_data = check_mongo_health()

    # 3. Redis Health Check
    redis_data = check_redis_health()

    overall_healthy = pg_connected and mongo_data["connected"] and redis_data["connected"]

    return HealthStatusOut(
        status="healthy" if overall_healthy else "operational (resilient mode)",
        timestamp=datetime.now(timezone.utc),
        postgres={
            "status": pg_status,
            "connected": pg_connected,
            "latency_ms": pg_latency,
        },
        mongodb=MongoHealthOut(**mongo_data),
        redis=RedisHealthOut(**redis_data),
    )


@router.get(
    "/mongodb",
    response_model=MongoHealthOut,
    summary="Dedicated MongoDB health check",
    description="Ping MongoDB server, measures latency, and reports file collection stats.",
)
def get_mongodb_health() -> MongoHealthOut:
    data = check_mongo_health()
    return MongoHealthOut(**data)


@router.get(
    "/redis",
    response_model=RedisHealthOut,
    summary="Dedicated Redis health check",
    description="Ping Redis server, measures latency, and reports memory statistics.",
)
def get_redis_health() -> RedisHealthOut:
    data = check_redis_health()
    return RedisHealthOut(**data)
