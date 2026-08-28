from typing import List

from pydantic import BaseModel


class DailyCount(BaseModel):
    date: str
    count: int


class StorageAnalytics(BaseModel):
    total_files: int
    total_storage_bytes: int
    total_downloads: int
    total_active_shares: int
    uploads_last_7_days: List[DailyCount]
    downloads_last_7_days: List[DailyCount]


class SecuritySummary(BaseModel):
    failed_logins_last_7_days: int
    accounts_locked_last_7_days: int
    total_users: int
