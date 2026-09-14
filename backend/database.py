import os

from dotenv import load_dotenv

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base


load_dotenv()


DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:

    raise RuntimeError(
        "DATABASE_URL is not set. Add it to your .env file -- "
        "see .env.example for the expected format."
    )

engine = create_engine(
    DATABASE_URL,

   
    echo=os.environ.get("SQL_ECHO", "false").lower() == "true"
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def get_db():

    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()
