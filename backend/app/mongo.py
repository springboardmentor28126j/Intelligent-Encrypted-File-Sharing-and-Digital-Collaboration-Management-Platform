from pymongo import MongoClient
from .config import settings


mongo_client = None
mongo_db = None
activity_collection = None


def get_mongo_collection():
    global mongo_client, mongo_db, activity_collection

    if activity_collection is None:
        mongo_client = MongoClient(
            settings.mongodb_url,
            serverSelectionTimeoutMS=10000
        )
        mongo_db = mongo_client[settings.mongodb_db_name]
        activity_collection = mongo_db["activity_logs"]

    return activity_collection