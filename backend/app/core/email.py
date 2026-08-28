import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings

def send_registration_otp_email(email_to: str, otp: str):
    subject = "TrustShare - Email Verification Code"
    body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <div style="max-width: 500px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                <h2 style="color: #2563eb; text-align: center;">Welcome to TrustShare!</h2>
                <p>Hello,</p>
                <p>Thank you for signing up. Please use the verification code below to verify your email address and complete your registration:</p>
                <div style="text-align: center; margin: 20px 0;">
                    <span style="font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #2563eb; background: #f3f4f6; padding: 10px 20px; border-radius: 5px;">{otp}</span>
                </div>
                <p style="font-size: 13px; color: #666;">This OTP is valid for 10 minutes. Do not share this code with anyone.</p>
                <br/>
                <p style="font-size: 12px; color: #888;">If you did not initiate this registration, please ignore this email.</p>
            </div>
        </body>
    </html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.MAIL_FROM
    msg["To"] = email_to
    msg.attach(MIMEText(body, "html"))

    try:
        server = smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT)
        server.starttls()
        server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
        server.sendmail(settings.MAIL_FROM, email_to, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False


def send_otp_email(email_to: str, otp: str):
    subject = "TrustShare - Password Reset Verification Code"
    body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <div style="max-width: 500px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                <h2 style="color: #2563eb; text-align: center;">TrustShare Security</h2>
                <p>Hello,</p>
                <p>We received a request to reset your password. Please use the verification code below to complete the process:</p>
                <div style="text-align: center; margin: 20px 0;">
                    <span style="font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #16a34a; background: #f3f4f6; padding: 10px 20px; border-radius: 5px;">{otp}</span>
                </div>
                <p style="font-size: 13px; color: #666;">This OTP is valid for 10 minutes. Do not share this code with anyone.</p>
                <br/>
                <p style="font-size: 12px; color: #888;">If you did not request a password reset, please ignore this email.</p>
            </div>
        </body>
    </html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.MAIL_FROM
    msg["To"] = email_to
    msg.attach(MIMEText(body, "html"))

    try:
        server = smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT)
        server.starttls()
        server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
        server.sendmail(settings.MAIL_FROM, email_to, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False