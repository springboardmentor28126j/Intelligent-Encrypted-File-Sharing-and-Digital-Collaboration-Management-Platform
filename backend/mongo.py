from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)
db = client["trustshare"]
activity_logs = db["activity_logs"]

try:
    client.admin.command('ping')
    print("MongoDB connected successfully (Atlas)!")
except Exception as e:
    print(f"MongoDB connection failed: {e}")