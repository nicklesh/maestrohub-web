"""
Kid Notification Service for Maestro Habitat
Handles sending and tracking notifications to kids (students) for upcoming sessions
"""
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import uuid

logger = logging.getLogger(__name__)

class KidNotificationService:
    def __init__(self, db, email_service):
        self.db = db
        self.email_service = email_service
    
    async def send_session_reminder_to_kid(self, booking_id: str) -> Optional[Dict]:
        """
        Send session reminder to kid's email/phone if configured.
        Returns notification record if sent.
        """
        # Get booking details
        booking = await self.db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
        if not booking:
            logger.error(f"Booking {booking_id} not found")
            return None
        
        # Get student details
        student = await self.db.students.find_one({"student_id": booking["student_id"]}, {"_id": 0})
        if not student:
            logger.error(f"Student {booking['student_id']} not found")
            return None
        
        # Check if kid should be notified
        if not student.get("notify_upcoming_sessions", False):
            return None
        
        # Get tutor details
        tutor = await self.db.tutors.find_one({"tutor_id": booking["tutor_id"]}, {"_id": 0})
        tutor_user = await self.db.users.find_one({"user_id": tutor.get("user_id")}, {"_id": 0}) if tutor else None
        tutor_name = tutor_user.get("name", "Your Coach") if tutor_user else "Your Coach"
        
        notifications_sent = []
        
        # Send email if available
        if student.get("email"):
            try:
                await self._send_email_reminder(student, booking, tutor_name)
                notification = await self._record_notification(
                    booking_id=booking_id,
                    student_id=student["student_id"],
                    notification_type="email",
                    sent_to=student["email"]
                )
                notifications_sent.append(notification)
            except Exception as e:
                logger.error(f"Failed to send email reminder to kid: {e}")
        
        # Send SMS if available (placeholder - would integrate with SMS service)
        if student.get("phone"):
            try:
                await self._send_sms_reminder(student, booking, tutor_name)
                notification = await self._record_notification(
                    booking_id=booking_id,
                    student_id=student["student_id"],
                    notification_type="sms",
                    sent_to=student["phone"]
                )
                notifications_sent.append(notification)
            except Exception as e:
                logger.error(f"Failed to send SMS reminder to kid: {e}")
        
        return {"notifications_sent": notifications_sent} if notifications_sent else None
    
    async def _send_email_reminder(self, student: Dict, booking: Dict, tutor_name: str):
        """Send email reminder to kid"""
        session_date = booking["start_at"]
        if isinstance(session_date, str):
            session_date = datetime.fromisoformat(session_date.replace("Z", "+00:00"))
        
        formatted_date = session_date.strftime("%A, %B %d, %Y")
        formatted_time = session_date.strftime("%I:%M %p")
        
        subject = f"🎓 Upcoming Session Reminder - {formatted_date}"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563EB;">Hi {student['name']}! 👋</h2>
            <p style="font-size: 16px;">Just a friendly reminder about your upcoming session:</p>
            
            <div style="background: #F1F5F9; border-radius: 12px; padding: 20px; margin: 20px 0;">
                <p style="margin: 8px 0;"><strong>📅 Date:</strong> {formatted_date}</p>
                <p style="margin: 8px 0;"><strong>⏰ Time:</strong> {formatted_time}</p>
                <p style="margin: 8px 0;"><strong>👨‍🏫 Coach:</strong> {tutor_name}</p>
            </div>
            
            <p style="font-size: 14px; color: #64748B;">
                Make sure you're ready and prepared for a great learning session!
            </p>
            
            <p style="font-size: 12px; color: #94A3B8; margin-top: 30px;">
                This notification was sent by Maestro Habitat on behalf of your parent/guardian.
            </p>
        </div>
        """
        
        await self.email_service.send_email(
            to=student["email"],
            subject=subject,
            html=html
        )
        
        logger.info(f"Sent email reminder to kid {student['student_id']} at {student['email']}")
    
    async def _send_sms_reminder(self, student: Dict, booking: Dict, tutor_name: str):
        """
        Send SMS reminder to kid (placeholder - would integrate with Twilio/other SMS service)
        """
        session_date = booking["start_at"]
        if isinstance(session_date, str):
            session_date = datetime.fromisoformat(session_date.replace("Z", "+00:00"))
        
        formatted_date = session_date.strftime("%b %d")
        formatted_time = session_date.strftime("%I:%M %p")
        
        message = f"Hi {student['name']}! Reminder: You have a session with {tutor_name} on {formatted_date} at {formatted_time}. Be ready! - Maestro Habitat"
        
        # TODO: Integrate with SMS service (Twilio, etc.)
        # For now, just log it
        logger.info(f"Would send SMS to {student['phone']}: {message}")
    
    async def _record_notification(self, booking_id: str, student_id: str, 
                                   notification_type: str, sent_to: str) -> Dict:
        """Record that a notification was sent"""
        notification_id = f"kidnotif_{uuid.uuid4().hex[:12]}"
        
        notification_doc = {
            "notification_id": notification_id,
            "booking_id": booking_id,
            "student_id": student_id,
            "notification_type": notification_type,
            "sent_to": sent_to,
            "sent_at": datetime.now(timezone.utc),
            "status": "sent"
        }
        
        await self.db.kid_notifications.insert_one(notification_doc)
        
        return notification_doc
    
    async def get_booking_notifications(self, booking_id: str) -> List[Dict]:
        """Get all kid notifications for a booking"""
        notifications = await self.db.kid_notifications.find(
            {"booking_id": booking_id},
            {"_id": 0}
        ).sort("sent_at", -1).to_list(10)
        
        return notifications
    
    async def get_student_notifications(self, student_id: str, limit: int = 20) -> List[Dict]:
        """Get all notifications sent to a student"""
        notifications = await self.db.kid_notifications.find(
            {"student_id": student_id},
            {"_id": 0}
        ).sort("sent_at", -1).to_list(limit)
        
        return notifications
