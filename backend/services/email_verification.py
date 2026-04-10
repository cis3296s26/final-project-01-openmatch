import os
import smtplib
import secrets
import hashlib
from datetime import datetime, timezone, timedelta
import resend
from sqlalchemy import text
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from core.config import FRONTEND_URL, MAIL_SENDER, MAIL_PASSWORD, RESEND_API_KEY, EMAIL_FROM, APP_ENV

def send_email_smtp(to: str, subject: str, body: str):
    if not MAIL_SENDER or not MAIL_PASSWORD:
        raise RuntimeError("MAIL_USERNAME or MAIL_PASSWORD is missing")

    msg = MIMEMultipart()
    msg["From"] = MAIL_SENDER
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=15) as server:
        server.login(MAIL_SENDER, MAIL_PASSWORD)
        server.sendmail(MAIL_SENDER, to, msg.as_string())


def send_email_resend(to: str, subject: str, body: str):
    if not RESEND_API_KEY:
        raise RuntimeError("RESEND_API_KEY is missing")

    resend.api_key = RESEND_API_KEY

    resend.Emails.send(
        {
            "from": EMAIL_FROM,
            "to": [to],
            "subject": subject,
            "html": body,
        }
    )

def send_email(to: str, subject: str, body: str):
    if APP_ENV == "prod":
        send_email_resend(to, subject, body)
    else:
        send_email_smtp(to, subject, body)


async def create_and_send_verification_email(row: map, conn):
    # Token generation
    plaintext_token = secrets.token_urlsafe(32)
    hashed_token = hashlib.sha256(plaintext_token.encode()).hexdigest()
    verify_url = f"{FRONTEND_URL}/login/verify?token={plaintext_token}"

    # Insert the new email token into the database
    conn.execute(
        text(
            """
            INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
            VALUES (:user_id, :token_hash, :expires_at)
            """
        ),
        {
            "user_id": row["id"],
            "token_hash": hashed_token,
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=24),
        },
    )

    # Email Formatting
    email_html = f"""
    <p>Welcome to OpenMatch.</p>
    <p>Please verify your email by clicking the link below:</p>
    <p><a href="{verify_url}">Verify Email</a></p>
    <p>{verify_url}</p>
    """

    # Try to send the email
    try:
        send_email(
            to=row["email"],
            subject="Openmatch Email Verification",
            body=email_html
        )
    except Exception as e:
        print(f"EMAIL FAILED: {e}. Is this intentional?")

    # Print verification email contents to console if MAIL_USERNAME is not defined (For development)
    if not MAIL_SENDER:
        print(email_html)