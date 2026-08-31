from pymongo import MongoClient

MONGO_URL = "mongodb://localhost:27017"

client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
mongo_db = client["trustshare_logs"]
activity_logs = mongo_db["activity_logs"]

try:
    client.admin.command('ping')
    print("MongoDB connected successfully (local)!")
except Exception as e:
    print(f"MongoDB connection test failed: {e}")