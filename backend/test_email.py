import smtplib
from email.message import EmailMessage
import os
from dotenv import load_dotenv

load_dotenv()

host = os.getenv("SMTP_HOST")
port = int(os.getenv("SMTP_PORT", "587"))
username = os.getenv("SMTP_USERNAME")
password = os.getenv("SMTP_PASSWORD")
from_email = os.getenv("SMTP_FROM_EMAIL")
to_email = os.getenv("TEST_EMAIL_TO")

if not all([host, username, password, from_email, to_email]):
    raise ValueError("Missing SMTP configuration in .env")

msg = EmailMessage()
msg["Subject"] = "TrustShare Email Test"
msg["From"] = from_email
msg["To"] = to_email
msg.set_content("This is a test email from the TrustShare project.")

print("Connecting to:", host, port)
print("Sending from:", from_email)
print("Sending to:", to_email)

with smtplib.SMTP(host, port) as server:
    server.starttls()
    server.login(username, password)
    server.send_message(msg)

print("TEST EMAIL SENT")