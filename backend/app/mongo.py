from pymongo import MongoClient

from .config import settings


mongo_client = MongoClient(settings.mongodb_url)

mongo_db = mongo_client[settings.mongodb_db_name]

activity_collection = mongo_db["activity_logs"]