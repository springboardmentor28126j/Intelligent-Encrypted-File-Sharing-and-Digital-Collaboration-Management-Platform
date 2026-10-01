from functools import lru_cache

from pymongo import MongoClient
from pymongo.errors import PyMongoError

from app.core.config import settings


@lru_cache
def get_mongo_client() -> MongoClient:
    return MongoClient(
        settings.MONGODB_URL,
        serverSelectionTimeoutMS=3000,
    )


def get_mongo_database():
    return get_mongo_client()[settings.MONGODB_DB]


def get_activity_collection():
    return get_mongo_database()["activity_logs"]


def check_mongodb() -> bool:
    try:
        get_mongo_client().admin.command("ping")
        return True

    except PyMongoError:
        return False