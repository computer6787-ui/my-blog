import os
from fastapi_mail import ConnectionConfig
from dotenv import load_dotenv
from fastapi_mail import FastMail, MessageSchema, MessageType
load_dotenv()

conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_FROM=os.getenv("MAIL_FROM"),
    MAIL_PORT=int(os.getenv("MAIL_PORT")),
    MAIL_SERVER=os.getenv("MAIL_SERVER"),
    MAIL_STARTTLS=os.getenv("MAIL_STARTTLS") == "True",
    MAIL_SSL_TLS=os.getenv("MAIL_SSL_TLS") == "True",
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)


async def send_verification_email(user_email, code):
    message = MessageSchema(
        subject="Verify your account",
        recipients=[user_email],
        body=f"""Subject: Verify your account

Welcome!

Thank you for creating an account with us.

To complete your registration, please use the verification code below:

{code}

This code will expire in 10 minutes. If you did not create this account, you can safely ignore this email.

Thanks,
The Murgi Team
""",
        subtype=MessageType.plain
    )

    fm = FastMail(conf)
    await fm.send_message(message)