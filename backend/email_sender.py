import os
import base64
import asyncio
import httpx
import random
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

# Load the backend's own .env, independent of the process cwd.
ENV_FILE = Path(__file__).with_name(".env")
load_dotenv(dotenv_path=ENV_FILE, override=True)

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", "Certificates <onboarding@resend.dev>")
EMAIL_SUBJECT = os.getenv("EMAIL_SUBJECT", "Your Certificate of Completion")
EMAIL_BODY = os.getenv("EMAIL_BODY", "<p>Hello,<br><br>Thank you for participating! Please find your personalized certificate of completion attached to this email.<br><br>Best regards,<br>Event Team</p>")
BREVO_FORCE_IPV4 = os.getenv("BREVO_FORCE_IPV4", "true").lower() in ("1", "true", "yes", "on")


def get_active_provider():
    """Prefer Resend whenever its key is configured; retain Brevo as fallback."""
    configured = os.getenv("EMAIL_PROVIDER", "").strip().lower()
    if os.getenv("RESEND_API_KEY", "").strip():
        return "resend"
    if configured == "brevo" and os.getenv("BREVO_API_KEY", "").strip():
        return "brevo"
    return configured or "mock"


# Configuration: resend, brevo, or mock. Resend wins over stale EMAIL_PROVIDER values.
PROVIDER = get_active_provider()

# Fallback check
if PROVIDER == "resend" and not RESEND_API_KEY:
    print("WARNING: EMAIL_PROVIDER is set to 'resend' but RESEND_API_KEY is missing. Defaulting to 'mock'.")
    PROVIDER = "mock"
elif PROVIDER == "brevo" and not BREVO_API_KEY:
    print("WARNING: EMAIL_PROVIDER is set to 'brevo' but BREVO_API_KEY is missing. Defaulting to 'mock'.")
    PROVIDER = "mock"

async def send_email_with_retry(
    to_email: str,
    pdf_path: str,
    subject: str = EMAIL_SUBJECT,
    body: str = EMAIL_BODY,
    from_email: str = EMAIL_FROM,
    provider: str = None,
    api_key: str = None,
    max_retries: int = 3,
    initial_backoff: float = 1.0
):
    """
    Sends an email with a PDF attachment. Integrates exponential backoff + jitter for retries.
    """
    # Reload the backend's .env so an explicitly restarted worker sees current values.
    load_dotenv(dotenv_path=ENV_FILE, override=True)
    
    if not provider:
        provider = get_active_provider()
        
    if not api_key:
        api_key = os.getenv("RESEND_API_KEY", "") if provider == "resend" else os.getenv("BREVO_API_KEY", "")

    # If provider is mock or there is no api_key for real providers, use mock
    if provider == "mock" or not api_key:
        # Simulate network latency
        await asyncio.sleep(0.3 + random.random() * 0.4)
        print(f"[MOCK EMAIL] Sent certificate PDF {pdf_path} to {to_email} via Mock provider.")
        return True, "Mock delivery successful"

    # Read and encode attachment
    if not os.path.exists(pdf_path):
        return False, f"PDF file not found at path: {pdf_path}"
    
    try:
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()
            pdf_base64 = base64.b64encode(pdf_bytes).decode("utf-8")
    except Exception as e:
        return False, f"Failed to read/encode PDF: {str(e)}"

    filename = os.path.basename(pdf_path)

    # API Payload setup
    url = ""
    headers = {}
    json_data = {}

    if provider == "resend":
        url = "https://api.resend.com/emails"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        json_data = {
            "from": from_email,
            "to": [to_email],
            "subject": subject,
            "html": body,
            "attachments": [
                {
                    "filename": filename,
                    "content": pdf_base64
                }
            ]
        }
    elif provider == "brevo":
        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "api-key": api_key,
            "Content-Type": "application/json"
        }
        # Extract sender name and email from "Name <email@domain.com>" format
        sender_name = "Event Coordinator"
        sender_email = from_email
        if "<" in from_email and ">" in from_email:
            parts = from_email.split("<")
            sender_name = parts[0].strip()
            sender_email = parts[1].replace(">", "").strip()

        json_data = {
            "sender": {"name": sender_name, "email": sender_email},
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": body,
            "attachment": [
                {
                    "content": pdf_base64,
                    "name": filename
                }
            ]
        }

    else:
        return False, f"Unsupported email provider: {provider}"

    # Execution loop with backoff
    backoff = initial_backoff
    transport = None
    if provider == "brevo" and BREVO_FORCE_IPV4:
        # Brevo authorizes source IPs individually. Bind the connection to IPv4
        # when the server has both IPv4 and IPv6, so it uses the authorized IPv4.
        transport = httpx.AsyncHTTPTransport(local_address="0.0.0.0")

    async with httpx.AsyncClient(timeout=30.0, transport=transport) as client:
        for attempt in range(1, max_retries + 1):
            try:
                response = await client.post(url, headers=headers, json=json_data)
                if response.status_code in (200, 201, 202):
                    return True, f"Email delivered successfully via {provider} on attempt {attempt}"
                
                # Check for rate limit or server error
                resp_text = response.text
                print(f"API attempt {attempt} failed with status {response.status_code}: {resp_text}")
                
                if attempt == max_retries:
                    return False, f"API error status {response.status_code}: {resp_text}"
            except Exception as e:
                print(f"Connection error on attempt {attempt}: {str(e)}")
                if attempt == max_retries:
                    return False, f"Connection error: {str(e)}"
            
            # Backoff wait with jitter
            sleep_time = backoff + (random.random() * 0.5 * backoff)
            print(f"Retrying email send to {to_email} in {sleep_time:.2f} seconds...")
            await asyncio.sleep(sleep_time)
            backoff *= 2  # Double backoff

    return False, "Failed to send email after max retries"
