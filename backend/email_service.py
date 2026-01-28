"""
Email Service for Maestro Habitat
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
FROM_EMAIL = os.environ.get('FROM_EMAIL', 'Maestro Habitat <onboarding@resend.dev>')


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
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Maestro Habitat</h1>
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
          © 2025 Maestro Habitat. All rights reserved.<br>
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

© 2025 Maestro Habitat
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
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Maestro Habitat</h1>
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
        <p style="color: #999; font-size: 12px; margin: 0;">© 2025 Maestro Habitat</p>
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
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Maestro Habitat</h1>
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
        <p style="color: #999; font-size: 12px; margin: 0;">© 2025 Maestro Habitat</p>
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
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Maestro Habitat</h1>
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
        <p style="color: #999; font-size: 12px; margin: 0;">© 2025 Maestro Habitat</p>
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
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Maestro Habitat</h1>
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
        <p style="color: #999; font-size: 12px; margin: 0;">© 2025 Maestro Habitat</p>
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


def welcome_verification_email(
    user_name: str,
    verification_url: str,
    lang: str = "en"
) -> Dict[str, str]:
    """Generate welcome email with verification link for new registrations - Branded to match login page"""
    
    # Brand colors matching the app login page
    primary_blue = "#3B82F6"  # Blue from login page
    gold_accent = "#D4AF37"   # Gold accent
    text_dark = "#1F2937"
    text_muted = "#6B7280"
    bg_light = "#F8FAFC"
    
    # Logo URL - hosted on your production domain
    logo_url = "https://www.maestrohabitat.com/assets/mh_logo_1024_transparent.png"
    
    html = f"""
<!DOCTYPE html>
<html lang="{lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Maestro Habitat</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #E8F4FD 0%, #FDF8E8 50%, #F0E6D8 100%);">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px; background: linear-gradient(135deg, #E8F4FD 0%, #FDF8E8 50%, #F0E6D8 100%);">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: rgba(255, 255, 255, 0.95); border-radius: 24px; overflow: hidden; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);">
          
          <!-- Logo Header -->
          <tr>
            <td style="padding: 40px 24px 20px 24px; text-align: center; background: linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,250,252,1) 100%);">
              <!-- MH Logo Image -->
              <img src="{logo_url}" alt="Maestro Habitat" style="width: 120px; height: auto; margin-bottom: 16px;" />
              <h1 style="color: {primary_blue}; margin: 0 0 8px 0; font-size: 28px; font-weight: 700; font-family: 'Georgia', serif;">
                Maestro Habitat
              </h1>
              <p style="color: {gold_accent}; margin: 0; font-size: 14px; font-style: italic; font-family: 'Georgia', serif;">
                Where potential resolves into mastery!
              </p>
            </td>
          </tr>
          
          <!-- Welcome Banner -->
          <tr>
            <td style="padding: 24px 24px 16px 24px; text-align: center;">
              <h2 style="color: {text_dark}; margin: 0; font-size: 22px; font-weight: 600;">
                🎉 Welcome, {user_name}!
              </h2>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <p style="color: {text_dark}; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0; text-align: center;">
                Thank you for joining <strong>Maestro Habitat</strong>! We're thrilled to have you as part of our community.
              </p>
              
              <p style="color: {text_muted}; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0; text-align: center;">
                To complete your registration, please verify your email address:
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 8px 0 24px 0;">
                    <a href="{verification_url}" style="display: inline-block; background: {primary_blue}; color: #ffffff; padding: 16px 48px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);">
                      ✉️ Verify My Email
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Link fallback -->
              <p style="color: {text_muted}; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
                Or copy and paste this link:<br>
                <a href="{verification_url}" style="color: {primary_blue}; word-break: break-all; font-size: 11px;">{verification_url}</a>
              </p>
            </td>
          </tr>
          
          <!-- Warning Box -->
          <tr>
            <td style="padding: 0 24px 16px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FEF3C7; border-radius: 12px; border-left: 4px solid {gold_accent};">
                <tr>
                  <td style="padding: 14px 18px;">
                    <p style="color: #92400E; font-size: 13px; margin: 0; line-height: 1.5;">
                      <strong>⏰ Link expires in 24 hours</strong><br>
                      If you don't verify within this time, you'll need to register again.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- What's Next Section -->
          <tr>
            <td style="padding: 8px 32px 24px 32px;">
              <p style="color: {text_dark}; font-size: 14px; font-weight: 600; margin: 0 0 12px 0;">What's next?</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: {primary_blue}; font-size: 16px;">✓</span>
                    <span style="color: {text_muted}; font-size: 13px; margin-left: 10px;">Browse our expert coaches</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: {primary_blue}; font-size: 16px;">✓</span>
                    <span style="color: {text_muted}; font-size: 13px; margin-left: 10px;">Book your first session</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: {primary_blue}; font-size: 16px;">✓</span>
                    <span style="color: {text_muted}; font-size: 13px; margin-left: 10px;">Start your learning journey</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: linear-gradient(180deg, {bg_light} 0%, #EDF2F7 100%); padding: 20px 24px; text-align: center; border-top: 1px solid #E2E8F0;">
              <p style="color: #9CA3AF; font-size: 11px; margin: 0 0 6px 0;">
                © 2025 Maestro Habitat. All rights reserved.
              </p>
              <p style="color: #9CA3AF; font-size: 11px; margin: 0;">
                <a href="https://www.maestrohabitat.com" style="color: {primary_blue}; text-decoration: none;">www.maestrohabitat.com</a>
              </p>
              <p style="color: #D1D5DB; font-size: 10px; margin: 12px 0 0 0;">
                If you didn't create this account, please ignore this email.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    
    text = f"""
Welcome to Maestro Habitat, {user_name}!

Where potential resolves into mastery!

Thank you for joining us. We're excited to have you on board.

To complete your registration, please verify your email by visiting:
{verification_url}

⏰ IMPORTANT: This link expires in 24 hours.

What's next?
✓ Browse our expert coaches
✓ Book your first session  
✓ Start your learning journey

© 2025 Maestro Habitat | www.maestrohabitat.com
"""
    
    return {
        "subject": "🎉 Welcome to Maestro Habitat - Verify Your Email",
        "html": html,
        "text": text
    }


def password_reset_email(
    user_name: str,
    reset_url: str,
    lang: str = "en"
) -> Dict[str, str]:
    """Generate password reset email - Branded to match login page"""
    
    # Brand colors matching the app login page
    primary_blue = "#3B82F6"  # Blue from login page
    gold_accent = "#D4AF37"   # Gold accent
    text_dark = "#1F2937"
    text_muted = "#6B7280"
    bg_light = "#F8FAFC"
    
    html = f"""
<!DOCTYPE html>
<html lang="{lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password - Maestro Habitat</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #E8F4FD 0%, #FDF8E8 50%, #F0E6D8 100%);">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px; background: linear-gradient(135deg, #E8F4FD 0%, #FDF8E8 50%, #F0E6D8 100%);">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: rgba(255, 255, 255, 0.95); border-radius: 24px; overflow: hidden; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);">
          
          <!-- Logo Header -->
          <tr>
            <td style="padding: 40px 24px 20px 24px; text-align: center; background: linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,250,252,1) 100%);">
              <!-- MH Logo Stylized -->
              <div style="margin-bottom: 16px;">
                <span style="font-family: 'Georgia', serif; font-size: 56px; font-weight: bold; font-style: italic; color: {primary_blue}; text-shadow: 2px 2px 4px rgba(0,0,0,0.1);">m</span>
                <span style="font-family: 'Georgia', serif; font-size: 56px; font-weight: bold; font-style: italic; color: {primary_blue}; position: relative; left: -10px; text-shadow: 2px 2px 4px rgba(0,0,0,0.1);">h</span>
              </div>
              <h1 style="color: {primary_blue}; margin: 0 0 8px 0; font-size: 28px; font-weight: 700; font-family: 'Georgia', serif;">
                <span style="color: {primary_blue};">Maestro</span> <span style="color: {primary_blue};">Habitat</span>
              </h1>
              <p style="color: {gold_accent}; margin: 0; font-size: 14px; font-style: italic; font-family: 'Georgia', serif;">
                Where potential resolves into mastery!
              </p>
            </td>
          </tr>
          
          <!-- Password Reset Banner -->
          <tr>
            <td style="padding: 24px 24px 16px 24px; text-align: center;">
              <h2 style="color: {text_dark}; margin: 0; font-size: 22px; font-weight: 600;">
                🔐 Password Reset Request
              </h2>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <p style="color: {text_dark}; font-size: 15px; line-height: 1.7; margin: 0 0 8px 0; text-align: center;">
                Hi <strong>{user_name}</strong>,
              </p>
              
              <p style="color: {text_muted}; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0; text-align: center;">
                We received a request to reset your password for your Maestro Habitat account. Click the button below to create a new password:
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 8px 0 24px 0;">
                    <a href="{reset_url}" style="display: inline-block; background: {primary_blue}; color: #ffffff; padding: 16px 48px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);">
                      🔑 Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Link fallback -->
              <p style="color: {text_muted}; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
                Or copy and paste this link:<br>
                <a href="{reset_url}" style="color: {primary_blue}; word-break: break-all; font-size: 11px;">{reset_url}</a>
              </p>
            </td>
          </tr>
          
          <!-- Warning Box -->
          <tr>
            <td style="padding: 0 24px 12px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FEF3C7; border-radius: 12px; border-left: 4px solid {gold_accent};">
                <tr>
                  <td style="padding: 14px 18px;">
                    <p style="color: #92400E; font-size: 13px; margin: 0; line-height: 1.5;">
                      <strong>⏰ Link expires in 1 hour</strong><br>
                      For security reasons, this password reset link will expire soon.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Security Notice -->
          <tr>
            <td style="padding: 0 24px 24px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FEF2F2; border-radius: 12px; border-left: 4px solid #EF4444;">
                <tr>
                  <td style="padding: 14px 18px;">
                    <p style="color: #991B1B; font-size: 13px; margin: 0; line-height: 1.5;">
                      <strong>🔒 Didn't request this?</strong><br>
                      If you didn't request a password reset, please ignore this email. Your password will remain unchanged and your account is secure.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: linear-gradient(180deg, {bg_light} 0%, #EDF2F7 100%); padding: 20px 24px; text-align: center; border-top: 1px solid #E2E8F0;">
              <p style="color: #9CA3AF; font-size: 11px; margin: 0 0 6px 0;">
                © 2025 Maestro Habitat. All rights reserved.
              </p>
              <p style="color: #9CA3AF; font-size: 11px; margin: 0;">
                <a href="https://www.maestrohabitat.com" style="color: {primary_blue}; text-decoration: none;">www.maestrohabitat.com</a>
              </p>
              <p style="color: #D1D5DB; font-size: 10px; margin: 12px 0 0 0;">
                This is an automated security email. Please do not reply.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    
    text = f"""
Maestro Habitat - Password Reset Request

Where potential resolves into mastery!

Hi {user_name},

We received a request to reset your password for your Maestro Habitat account.

Click here to reset your password:
{reset_url}

⏰ IMPORTANT: This link expires in 1 hour for security reasons.

🔒 SECURITY NOTICE: If you didn't request this password reset, please ignore this email. Your password will remain unchanged.

© 2025 Maestro Habitat | www.maestrohabitat.com
"""
    
    return {
        "subject": "🔐 Reset Your Password - Maestro Habitat",
        "html": html,
        "text": text
    }


# Singleton instance
email_service = EmailService()
