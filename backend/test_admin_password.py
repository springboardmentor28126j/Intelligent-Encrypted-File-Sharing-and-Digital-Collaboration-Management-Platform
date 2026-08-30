from database import SessionLocal
from models import User
from security import verify_password


db = SessionLocal()

try:

    email = "admin@example.com"
    password = "Admin@12345"

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if user is None:

        print("ADMIN USER NOT FOUND")

    else:

        print("User ID:", user.id)
        print("Name:", user.name)
        print("Email:", user.email)
        print("Role:", user.role)

        try:

            result = verify_password(
                password,
                user.password
            )

            print("Password valid:", result)

        except Exception as error:

            print(
                "Password verification error:",
                repr(error)
            )

finally:

    db.close()