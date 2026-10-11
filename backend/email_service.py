from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from pydantic_settings import BaseSettings


class MailSettings(BaseSettings):
    MAIL_USERNAME: str
    MAIL_PASSWORD: str
    MAIL_FROM: str

    class Config:
        env_file = ".env"
        extra = "ignore"


mail_settings = MailSettings()


mail_config = ConnectionConfig(
    MAIL_USERNAME=mail_settings.MAIL_USERNAME,
    MAIL_PASSWORD=mail_settings.MAIL_PASSWORD,
    MAIL_FROM=mail_settings.MAIL_FROM,
    MAIL_PORT=587,
    MAIL_SERVER="smtp.gmail.com",
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
)


async def send_notification_email(
    recipient_email: str,
    title: str,
    message: str
):
    email_message = MessageSchema(
        subject=f"TrustShare - {title}",
        recipients=[recipient_email],
        body=f"""
Hello,

You have a new notification from TrustShare.

{title}

{message}

Please log in to your TrustShare account to view more details.

Regards,
TrustShare Team
""",
        subtype="plain"
    )

    fm = FastMail(mail_config)

    await fm.send_message(email_message)