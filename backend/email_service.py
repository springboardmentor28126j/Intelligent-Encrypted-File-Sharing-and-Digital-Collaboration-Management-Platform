import os
import smtplib
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()

EMAIL_ADDRESS = os.getenv("EMAIL_ADDRESS")
EMAIL_APP_PASSWORD = os.getenv("EMAIL_APP_PASSWORD")


def send_email(to_email: str, subject: str, body: str):
    """Send a plain-text email via Gmail SMTP. Fails silently (non-critical) so
    a broken email config never breaks the actual feature (alert/reset still works)."""
    try:
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = EMAIL_ADDRESS
        msg["To"] = to_email

        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(EMAIL_ADDRESS, EMAIL_APP_PASSWORD)
            server.sendmail(EMAIL_ADDRESS, to_email, msg.as_string())

        print(f"Email sent to {to_email}")
        return True
    except Exception as e:
        print(f"Email sending failed (non-critical): {e}")
        return False