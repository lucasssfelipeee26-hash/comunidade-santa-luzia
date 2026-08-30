from __future__ import annotations

import os
import smtplib
import ssl
from email.message import EmailMessage


def recovery_email_configured() -> bool:
    return all(os.getenv(name, "").strip() for name in ("SMTP_HOST", "SMTP_USER", "SMTP_PASS"))


def send_recovery_code(recipient: str, name: str, code: str) -> bool:
    host = os.getenv("SMTP_HOST", "").strip()
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASS", "")
    if not host or not user or not password:
        return False
    try:
        port = int(os.getenv("SMTP_PORT", "587"))
    except ValueError:
        port = 587

    message = EmailMessage()
    message["From"] = os.getenv("EMAIL_FROM", "").strip() or user
    message["To"] = recipient
    message["Subject"] = "Código de recuperação de senha — Comunidade Santa Luzia"
    message.set_content(
        "\n".join(
            [
                f"Olá, {name}.",
                "",
                "Recebemos uma solicitação para redefinir sua senha no aplicativo Santa Luzia.",
                "",
                f"Seu código de verificação é: {code}",
                "",
                "O código expira em 15 minutos e só pode ser usado uma vez.",
                "Se você não solicitou a alteração, ignore esta mensagem.",
            ]
        )
    )
    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=20, context=ssl.create_default_context()) as smtp:
                smtp.login(user, password)
                smtp.send_message(message)
        else:
            with smtplib.SMTP(host, port, timeout=20) as smtp:
                smtp.ehlo()
                smtp.starttls(context=ssl.create_default_context())
                smtp.ehlo()
                smtp.login(user, password)
                smtp.send_message(message)
        return True
    except Exception:
        return False
