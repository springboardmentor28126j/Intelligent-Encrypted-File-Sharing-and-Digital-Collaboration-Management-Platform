import argparse
import sys

from app.database import SessionLocal
from app.models import User


def main() -> int:
    parser = argparse.ArgumentParser(description="Promote an existing TrustShare user to admin.")
    parser.add_argument("email", help="Email address of the existing user account")
    args = parser.parse_args()

    email = args.email.strip().lower()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"No user found for {email}. Register that account first.")
            return 1

        user.role = "admin"
        db.commit()
        print(f"Admin role assigned to {user.email}.")
        print("Log out and log in again for the updated role to appear in the session.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
