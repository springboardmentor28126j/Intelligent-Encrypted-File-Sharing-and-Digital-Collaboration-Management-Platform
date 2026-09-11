import asyncio
from sqlalchemy import select
from src.models.sql.database import AsyncSessionLocal
from src.models.sql.user import User
from src.core.security import get_password_hash

async def seed():
    async with AsyncSessionLocal() as db:
        admin = await db.scalar(select(User).where(User.email == "admin@trustshare.io"))
        if not admin:
            admin = User(
                email="admin@trustshare.io",
                hashed_password=get_password_hash("Admin@TrustShare123!"),
                full_name="Platform Administrator",
                role="admin",
                is_active=True
            )
            db.add(admin)
            print("Created default admin: admin@trustshare.io / Admin@TrustShare123!")

        demo_user = await db.scalar(select(User).where(User.email == "demo@trustshare.io"))
        if not demo_user:
            demo_user = User(
                email="demo@trustshare.io",
                hashed_password=get_password_hash("DemoUser123!"),
                full_name="Demo User",
                role="user",
                is_active=True
            )
            db.add(demo_user)
            print("Created default demo user: demo@trustshare.io / DemoUser123!")

        await db.commit()
        print("Database seeding completed successfully.")

if __name__ == "__main__":
    asyncio.run(seed())
