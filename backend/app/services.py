import os

from dotenv import load_dotenv
from pymongo import MongoClient
import redis

load_dotenv()


# PostgreSQL configuration
POSTGRES_URL = os.getenv(
    "POSTGRES_URL",
    "postgresql://postgres:password@localhost:5432/trustshare"
)


# MongoDB configuration
MONGO_URL = os.getenv(
    "MONGO_URL",
    "mongodb://localhost:27017"
)

mongo_client = MongoClient(
    MONGO_URL,
    serverSelectionTimeoutMS=2000
)


# Redis configuration
REDIS_URL = os.getenv(
    "REDIS_URL",
    "redis://localhost:6379/0"
)

redis_client = redis.from_url(
    REDIS_URL,
    decode_responses=True
)