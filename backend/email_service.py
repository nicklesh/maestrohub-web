"""
Email Service for Maestro Hub
Uses Resend API for production, mocks for development
"""

import os
import logging
from typing import Optional, Dict, Any
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)

# Check if we have a real Resend API key
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
IS_MOCK_MODE = not RESEND_API_KEY or RESEND_API_KEY.startswith('re_placeholder') or RESEND_API_KEY == ''

# Email sender - using Resend's test domain by default
FROM_EMAIL = os.environ.get('FROM_EMAIL', 'Maestro Hub <onboarding@resend.dev>')


class EmailService:
    """Email service with Resend integration (mocked when no API key)"""
    
    @staticmethod
    async def send_email(
        to: str,
        subject: str,
        html: str,
        text: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send an email via Resend or mock"""
        
        if IS_MOCK_MODE:
            # Mock mode - log the email
            logger.info(f"""
╔══════════════════════════════════════════════════════════════╗
║  📧 MOCK EMAIL SENT                                           ║
╠══════════════════════════════════════════════════════════════╣
║  To: {to}
║  Subject: {subject}
║  
║  Body Preview:
║  {html[:200]}...
╚══════════════════════════════════════════════════════════════╝
""")
            return {"success": True, "mock": True, "id": f"mock_{datetime.now().timestamp()}"}
        
        # Real Resend API call
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {RESEND_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "from": FROM_EMAIL,
                        "to": [to],
                        "subject": subject,
                        "html": html,
                        "text": text
                    }
                )
                
                if response.status_code == 200:
                    return {"success": True, "id": response.json().get("id")}
                else:
                    logger.error(f"Resend API error: {response.status_code} - {response.text}")
                    return {"success": False, "error": response.text}
        except Exception as e:
            logger.error(f"Email sending failed: {str(e)}")
            return {"success": False, "error": str(e)}


# ============== EMAIL TEMPLATES ==============

def booking_confirmation_email(
    consumer_name: str,
    coach_name: str,
    session_date: str,
    session_time: str,
    duration: int,
    price: str,
    meeting_link: Optional[str] = None
) -> Dict[str, str]:
    """Generate booking confirmation email"""
    
    meeting_section = ""
    if meeting_link:
        meeting_section = f"""
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
            <strong>Meeting Link:</strong><br>
            <a href="{meeting_link}" style="color: #4F46E5;">{meeting_link}</a>
          </td>
        </tr>
        """
    
    html = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background-color: #4F46E5; padding: 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Maestro Hub</h1>
      </td>
    </tr>
    
    <!-- Content -->
    <tr>
      <td style="padding: 32px 24px;">
        <h2 style="color: #1a1a1a; margin: 0 0 16px 0;">Booking Confirmed! ✅</h2>
        <p style="color: #666; font-size: 16px; line-height: 1.5; margin: 0 0 24px 0;">
          Hi {consumer_name},<br><br>
          Your session with <strong>{coach_name}</strong> has been confirmed!
        </p>
        
        <!-- Session Details -->
        <table width="100%" style="background-color: #f8f9fa; border-radius: 8px; margin-bottom: 24px;">
          <tr>
            <td style="padding: 20px;">
              <table width="100%">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
                    <strong>📅 Date:</strong><br>
                    {session_date}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
                    <strong>🕐 Time:</strong><br>
                    {session_time}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
                    <strong>⏱ Duration:</strong><br>
                    {duration} minutes
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
                    <strong>💰 Amount Paid:</strong><br>
                    {price}
                  </td>
                </tr>
                {meeting_section}
              </table>
            </td>
          </tr>
        </table>
        
        <p style="color: #666; font-size: 14px; line-height: 1.5;">
          <strong>What's next?</strong><br>
          • You'll receive a reminder 24 hours before your session<br>
          • Make sure to join on time<br>
          • You can cancel up to 24 hours before for a full refund
        </p>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="background-color: #f8f9fa; padding: 24px; text-align: center;">
        <p style="color: #999; font-size: 12px; margin: 0;">
          © 2025 Maestro Hub. All rights reserved.<br>
          <a href="#" style="color: #4F46E5;">Manage your bookings</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    
    text = f"""
Booking Confirmed!

Hi {consumer_name},

Your session with {coach_name} has been confirmed!

Session Details:
- Date: {session_date}
- Time: {session_time}
- Duration: {duration} minutes
- Amount Paid: {price}
{f"- Meeting Link: {meeting_link}" if meeting_link else ""}

What's next?
- You'll receive a reminder 24 hours before your session
- Make sure to join on time
- You can cancel up to 24 hours before for a full refund

© 2025 Maestro Hub
"""
    
    return {
        "subject": f"✅ Booking Confirmed with {coach_name}",
        "html": html,
        "text": text
    }


def booking_cancellation_email(
    recipient_name: str,
    other_party_name: str,
    session_date: str,
    session_time: str,
    is_consumer: bool = True,
    refund_info: Optional[str] = None
) -> Dict[str, str]:
    """Generate booking cancellation email"""
    
    role_text = "Your booking" if is_consumer else "A booking"
    refund_section = ""
    if refund_info and is_consumer:
        refund_section = f"""
        <tr>
          <td style="padding: 12px 0;">
            <strong>💳 Refund:</strong><br>
            {refund_info}
          </td>
        </tr>
        """
    
    html = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="background-color: #4F46E5; padding: 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Maestro Hub</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 24px;">
        <h2 style="color: #1a1a1a; margin: 0 0 16px 0;">Booking Cancelled</h2>
        <p style="color: #666; font-size: 16px; line-height: 1.5;">
          Hi {recipient_name},<br><br>
          {role_text} with <strong>{other_party_name}</strong> has been cancelled.
        </p>
        
        <table width="100%" style="background-color: #fef2f2; border-radius: 8px; margin: 24px 0;">
          <tr>
            <td style="padding: 20px;">
              <table width="100%">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #fecaca;">
                    <strong>📅 Original Date:</strong> {session_date}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <strong>🕐 Original Time:</strong> {session_time}
                  </td>
                </tr>
                {refund_section}
              </table>
            </td>
          </tr>
        </table>
        
        <p style="color: #666; font-size: 14px;">
          {"You can book another session anytime." if is_consumer else "The time slot is now available for other bookings."}
        </p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f8f9fa; padding: 24px; text-align: center;">
        <p style="color: #999; font-size: 12px; margin: 0;">© 2025 Maestro Hub</p>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    
    return {
        "subject": f"❌ Booking Cancelled - {session_date}",
        "html": html,
        "text": f"Hi {recipient_name}, {role_text} with {other_party_name} on {session_date} at {session_time} has been cancelled."
    }


def session_reminder_email(
    consumer_name: str,
    coach_name: str,
    session_date: str,
    session_time: str,
    hours_until: int,
    meeting_link: Optional[str] = None
) -> Dict[str, str]:
    """Generate session reminder email"""
    
    meeting_button = ""
    if meeting_link:
        meeting_button = f"""
        <a href="{meeting_link}" style="display: inline-block; background-color: #4F46E5; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 16px;">
          Join Session
        </a>
        """
    
    html = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="background-color: #4F46E5; padding: 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Maestro Hub</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 24px; text-align: center;">
        <h2 style="color: #1a1a1a; margin: 0 0 8px 0;">⏰ Session Reminder</h2>
        <p style="color: #4F46E5; font-size: 18px; font-weight: 600; margin: 0 0 24px 0;">
          {hours_until} hours to go!
        </p>
        
        <p style="color: #666; font-size: 16px; line-height: 1.5;">
          Hi {consumer_name},<br><br>
          Your session with <strong>{coach_name}</strong> is coming up!
        </p>
        
        <table width="100%" style="background-color: #f0fdf4; border-radius: 8px; margin: 24px 0;">
          <tr>
            <td style="padding: 20px; text-align: left;">
              <p style="margin: 0 0 8px 0;"><strong>📅 {session_date}</strong></p>
              <p style="margin: 0; font-size: 20px; color: #4F46E5;"><strong>🕐 {session_time}</strong></p>
            </td>
          </tr>
        </table>
        
        {meeting_button}
        
        <p style="color: #999; font-size: 14px; margin-top: 24px;">
          Make sure to be ready a few minutes early!
        </p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f8f9fa; padding: 24px; text-align: center;">
        <p style="color: #999; font-size: 12px; margin: 0;">© 2025 Maestro Hub</p>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    
    return {
        "subject": f"⏰ Reminder: Session with {coach_name} in {hours_until} hours",
        "html": html,
        "text": f"Hi {consumer_name}, your session with {coach_name} is in {hours_until} hours ({session_date} at {session_time})."
    }


def new_review_notification_email(
    coach_name: str,
    reviewer_name: str,
    rating: float,
    comment: Optional[str] = None
) -> Dict[str, str]:
    """Generate new review notification for coach"""
    
    stars = "⭐" * int(rating)
    comment_section = ""
    if comment:
        comment_section = f"""
        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 16px; margin-top: 16px;">
          <p style="color: #666; font-style: italic; margin: 0;">"{comment}"</p>
        </div>
        """
    
    html = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="background-color: #4F46E5; padding: 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Maestro Hub</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 24px;">
        <h2 style="color: #1a1a1a; margin: 0 0 16px 0;">New Review Received! ⭐</h2>
        <p style="color: #666; font-size: 16px; line-height: 1.5;">
          Hi {coach_name},<br><br>
          <strong>{reviewer_name}</strong> left you a review!
        </p>
        
        <div style="text-align: center; margin: 24px 0;">
          <p style="font-size: 32px; margin: 0;">{stars}</p>
          <p style="color: #4F46E5; font-size: 24px; font-weight: 700; margin: 8px 0;">{rating}/5</p>
        </div>
        
        {comment_section}
        
        <p style="color: #666; font-size: 14px; margin-top: 24px;">
          Responding to reviews helps build trust with potential clients!
        </p>
        
        <a href="#" style="display: inline-block; background-color: #4F46E5; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 16px;">
          Respond to Review
        </a>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f8f9fa; padding: 24px; text-align: center;">
        <p style="color: #999; font-size: 12px; margin: 0;">© 2025 Maestro Hub</p>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    
    return {
        "subject": f"⭐ New {rating}-star review from {reviewer_name}",
        "html": html,
        "text": f"Hi {coach_name}, {reviewer_name} left you a {rating}-star review! {comment or ''}"
    }


def no_show_notification_email(
    recipient_name: str,
    other_party_name: str,
    session_date: str,
    session_time: str,
    is_consumer: bool = True,
    penalty_info: Optional[str] = None
) -> Dict[str, str]:
    """Generate no-show notification email"""
    
    if is_consumer:
        title = "Session Missed"
        message = f"You missed your session with <strong>{other_party_name}</strong>."
        action_text = penalty_info or "Please contact support if this was an error."
    else:
        title = "Student No-Show"
        message = f"<strong>{other_party_name}</strong> did not attend the scheduled session."
        action_text = "You will still receive payment for this session."
    
    html = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="background-color: #DC2626; padding: 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Maestro Hub</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 24px;">
        <h2 style="color: #1a1a1a; margin: 0 0 16px 0;">⚠️ {title}</h2>
        <p style="color: #666; font-size: 16px; line-height: 1.5;">
          Hi {recipient_name},<br><br>
          {message}
        </p>
        
        <table width="100%" style="background-color: #fef2f2; border-radius: 8px; margin: 24px 0;">
          <tr>
            <td style="padding: 20px;">
              <p style="margin: 0 0 8px 0;"><strong>📅 Date:</strong> {session_date}</p>
              <p style="margin: 0;"><strong>🕐 Time:</strong> {session_time}</p>
            </td>
          </tr>
        </table>
        
        <p style="color: #666; font-size: 14px;">{action_text}</p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f8f9fa; padding: 24px; text-align: center;">
        <p style="color: #999; font-size: 12px; margin: 0;">© 2025 Maestro Hub</p>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    
    return {
        "subject": f"⚠️ {title} - {session_date}",
        "html": html,
        "text": f"Hi {recipient_name}, {message.replace('<strong>', '').replace('</strong>', '')} ({session_date} at {session_time})"
    }


# Singleton instance
email_service = EmailService()
