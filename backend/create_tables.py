from database import engine, Base
from models import User, File


# Create all database tables
Base.metadata.create_all(bind=engine)

print("Database tables created successfully!")