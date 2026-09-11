from motor.motor_asyncio import AsyncIOMotorClient
from src.core.config import settings
from typing import Optional

class MongoDBManager:
    client: Optional[AsyncIOMotorClient] = None

    def connect(self) -> None:
        self.client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=500)

    def close(self) -> None:
        if self.client:
            self.client.close()

    def get_database(self):
        if not self.client:
            self.connect()
        return self.client[settings.MONGODB_DB_NAME]

mongo_manager = MongoDBManager()

def get_mongo_db():
    return mongo_manager.get_database()
