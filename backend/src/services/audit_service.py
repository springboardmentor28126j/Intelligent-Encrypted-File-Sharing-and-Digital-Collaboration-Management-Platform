import asyncio
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from src.models.nosql.database import get_mongo_db
from src.models.nosql.audit import AuditLogEntry

class AuditService:
    @staticmethod
    async def log_event(
        category: str,
        action: str,
        actor: Dict[str, Any],
        resource: Dict[str, Any],
        status: str = "SUCCESS",
        details: Optional[Dict[str, Any]] = None
    ) -> str:
        entry = AuditLogEntry(
            category=category,
            action=action,
            actor=actor,
            resource=resource,
            status=status,
            details=details or {}
        )
        try:
            db = get_mongo_db()
            await asyncio.wait_for(db.audit_logs.insert_one(entry.model_dump()), timeout=0.5)
        except Exception:
            # Fallback / graceful degradation if MongoDB not connected in tests
            pass
        return entry.event_id

    @staticmethod
    async def query_logs(
        category: Optional[str] = None,
        action: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        try:
            db = get_mongo_db()
            query: Dict[str, Any] = {}
            if category:
                query["category"] = category
            if action:
                query["action"] = action
            if status:
                query["status"] = status
                
            cursor = db.audit_logs.find(query).sort("timestamp", -1).limit(limit)
            logs = []
            async for doc in cursor:
                doc["_id"] = str(doc["_id"])
                logs.append(doc)
            return logs
        except Exception:
            return []
