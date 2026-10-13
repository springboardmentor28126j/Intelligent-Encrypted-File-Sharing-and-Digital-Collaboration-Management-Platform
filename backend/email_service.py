import os
import smtplib
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()

# Multiple email accounts list
EMAIL_ACCOUNTS = [
    {
        "address": os.getenv("EMAIL_ADDRESS_1") or os.getenv("EMAIL_ADDRESS"),
        "password": os.getenv("EMAIL_APP_PASSWORD_1") or os.getenv("EMAIL_APP_PASSWORD")
    },
    {
        "address": os.getenv("EMAIL_ADDRESS_2"),
        "password": os.getenv("EMAIL_APP_PASSWORD_2")
    }
]

def send_email(to_email: str, subject: str, body: str, account_index: int = 0):
    """Send a plain-text email via Gmail SMTP using multiple email support.
    account_index: 0 for first email, 1 for second email, etc.
    """
    try:
        # Valid index check
        if account_index >= len(EMAIL_ACCOUNTS) or not EMAIL_ACCOUNTS[account_index]["address"]:
            account_index = 0

        sender_email = EMAIL_ACCOUNTS[account_index]["address"]
        sender_password = EMAIL_ACCOUNTS[account_index]["password"]

        if not sender_email or not sender_password:
            print(f"Email credentials missing for account index {account_index}")
            return False

        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = sender_email
        msg["To"] = to_email

        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, to_email, msg.as_string())

        print(f"Email sent from {sender_email} to {to_email}")
        return True
    except Exception as e:
        print(f"Email sending failed (non-critical): {e}")
        return False