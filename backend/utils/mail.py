import os
from typing import cast

from dotenv import load_dotenv
from pydantic import EmailStr
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

load_dotenv()

mail_from = os.getenv("MAIL_FROM")

if not mail_from:
    raise RuntimeError("MAIL_FROM environment variable is not set")

conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_FROM=cast(EmailStr, mail_from),
    MAIL_SERVER=os.getenv("MAIL_SERVER"),
    MAIL_PORT=int(os.getenv("MAIL_PORT", "2525")),
    MAIL_STARTTLS=os.getenv("MAIL_STARTTLS") == "True",
    MAIL_SSL_TLS=os.getenv("MAIL_SSL_TLS") == "True",
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,
)



async def send_verification_email(user_email, code):
    message = MessageSchema(
        subject="Verify your account",
        recipients=[user_email],
        body=f"""Welcome!

Thank you for creating an account with us.

To complete your registration, please use the verification code below:

{code}

This code will expire in 10 minutes. If you did not create this account, you can safely ignore this email.

Thanks,
The Murgi Team
""",
        subtype=MessageType.plain,
    )

    fm = FastMail(conf)
    await fm.send_message(message)


async def send_password_reset_email(user_email, code):
    message = MessageSchema(
        subject="Reset your password",
        recipients=[user_email],
        body=f"""Hello,

We received a request to reset the password for your account.

Use the code below to continue. This code will expire in 10 minutes.

{code}

If you did not request a password reset, you can safely ignore this email.

Thanks,
The Murgi Team
""",
        subtype=MessageType.plain,
    )

    fm = FastMail(conf)
    await fm.send_message(message)