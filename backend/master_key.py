"""
Run this once to generate a MASTER_KEY for your .env file.

The master key encrypts (wraps) every file's individual data key.
It must never be committed to source control -- keep it only in .env,
which should already be in your .gitignore.

Usage:
    python generate_master_key.py
"""
import os
import base64


def main():

    key = os.urandom(32)

    encoded = base64.b64encode(key).decode("utf-8")

    print("Add this line to your backend/.env file:")
    print()
    print(f"MASTER_KEY={encoded}")
    print()
    print("Keep this value secret. Losing it means every previously")
    print("uploaded file becomes permanently unrecoverable.")


if __name__ == "__main__":
    main()
