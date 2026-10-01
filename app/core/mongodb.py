from pymongo import MongoClient

from app.core.config import settings

client = MongoClient(settings.MONGODB_URL)

mongo_db = client["trustshare"]


def get_mongo_db():
    return mongo_db