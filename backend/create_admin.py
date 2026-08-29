from database import SessionLocal
from models import User
from security import hash_password


db = SessionLocal()

try:

    email = "admin@example.com"
    password = "Admin@12345"

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if user:

        # Make sure this account is an admin
        user.role = "admin"

        # Reset the password
        user.password = hash_password(password)

        db.commit()

        print("Admin account updated successfully.")
        print("Email:", email)
        print("Password:", password)
        print("Role:", user.role)

    else:

        admin = User(
            name="Admin",
            email=email,
            password=hash_password(password),
            role="admin"
        )

        db.add(admin)
        db.commit()

        print("Admin account created successfully.")
        print("Email:", email)
        print("Password:", password)
        print("Role: admin")

finally:

    db.close()