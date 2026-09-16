from sqlalchemy import inspect
from app.database import engine

insp = inspect(engine)
print("files columns:", sorted(c["name"] for c in insp.get_columns("files")))
print("users columns:", sorted(c["name"] for c in insp.get_columns("users")))
print("folders columns:", sorted(c["name"] for c in insp.get_columns("folders")))
print("file_shares columns:", sorted(c["name"] for c in insp.get_columns("file_shares")))
print("activity_logs columns:", sorted(c["name"] for c in insp.get_columns("activity_logs")))
