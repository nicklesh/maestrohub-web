"""
Notification Service for Maestro Habitat
Handles in-app notifications, reminders, and inbox functionality
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)


class NotificationService:
    def __init__(self, db, email_service=None):
        self.db = db
        self.email_service = email_service
    
    async def create_notification(self, user_id: str, notification_type: str,
                                  title: str, message: str, data: Dict = None) -> Dict:
        """Create a new notification for a user"""
        notification_id = f"notif_{uuid.uuid4().hex[:8]}"
        
        notification_doc = {
            "notification_id": notification_id,
            "user_id": user_id,
            "type": notification_type,
            "title": title,
            "message": message,
            "data": data or {},
            "read": False,
            "created_at": datetime.now(timezone.utc)
        }
        
        await self.db.notifications.insert_one(notification_doc)
        
        return {"success": True, "notification_id": notification_id}
    
    async def get_notifications(self, user_id: str, unread_only: bool = False,
                                limit: int = 50) -> List[Dict]:
        """Get notifications for a user"""
        query = {"user_id": user_id}
        if unread_only:
            query["read"] = False
        
        notifications = await self.db.notifications.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).to_list(limit)
        
        return notifications
    
    async def mark_as_read(self, notification_id: str, user_id: str) -> Dict:
        """Mark a notification as read"""
        result = await self.db.notifications.update_one(
            {"notification_id": notification_id, "user_id": user_id},
            {"$set": {"read": True, "read_at": datetime.now(timezone.utc)}}
        )
        
        if result.modified_count == 0:
            return {"success": False, "error": "Notification not found"}
        
        return {"success": True}
    
    async def mark_all_as_read(self, user_id: str) -> Dict:
        """Mark all notifications as read for a user"""
        result = await self.db.notifications.update_many(
            {"user_id": user_id, "read": False},
            {"$set": {"read": True, "read_at": datetime.now(timezone.utc)}}
        )
        
        return {"success": True, "count": result.modified_count}
    
    async def get_unread_count(self, user_id: str) -> int:
        """Get count of unread notifications"""
        count = await self.db.notifications.count_documents(
            {"user_id": user_id, "read": False}
        )
        return count
    
    async def delete_notification(self, notification_id: str, user_id: str) -> Dict:
        """Delete a notification"""
        result = await self.db.notifications.delete_one(
            {"notification_id": notification_id, "user_id": user_id}
        )
        
        if result.deleted_count == 0:
            return {"success": False, "error": "Notification not found"}
        
        return {"success": True}
    
    # ============== REMINDERS ==============
    async def get_user_reminders(self, user_id: str, role: str = "consumer") -> List[Dict]:
        """Get upcoming session reminders for a user"""
        now = datetime.now(timezone.utc)
        tomorrow = now + timedelta(days=1)
        
        if role == "consumer":
            query = {"consumer_id": user_id}
        else:
            tutor = await self.db.tutors.find_one({"user_id": user_id}, {"_id": 0})
            if not tutor:
                return []
            query = {"tutor_id": tutor["tutor_id"]}
        
        query["status"] = {"$in": ["booked", "confirmed"]}
        query["start_at"] = {"$gte": now, "$lte": tomorrow}
        
        bookings = await self.db.bookings.find(query, {"_id": 0}).sort("start_at", 1).to_list(20)
        
        reminders = []
        for booking in bookings:
            # Get related info
            student = await self.db.students.find_one({"student_id": booking.get("student_id")}, {"_id": 0})
            tutor = await self.db.tutors.find_one({"tutor_id": booking["tutor_id"]}, {"_id": 0})
            tutor_user = await self.db.users.find_one({"user_id": tutor["user_id"]}, {"_id": 0}) if tutor else None
            
            time_until = booking["start_at"] - now
            hours_until = time_until.total_seconds() / 3600
            
            reminders.append({
                "booking_id": booking["booking_id"],
                "type": "session_reminder",
                "student_name": student["name"] if student else "Unknown",
                "tutor_name": tutor_user["name"] if tutor_user else "Unknown",
                "start_at": booking["start_at"].isoformat() if hasattr(booking["start_at"], 'isoformat') else booking["start_at"],
                "hours_until": round(hours_until, 1),
                "status": booking["status"]
            })
        
        return reminders
    
    # ============== INBOX / CONTACT ==============
    async def submit_contact_form(self, name: str, email: str, subject: str,
                                  message: str, user_id: str = None) -> Dict:
        """Submit a contact form message"""
        contact_id = f"contact_{uuid.uuid4().hex[:12]}"
        
        contact_doc = {
            "contact_id": contact_id,
            "name": name,
            "email": email,
            "subject": subject,
            "message": message,
            "user_id": user_id,
            "status": "new",
            "created_at": datetime.now(timezone.utc)
        }
        
        await self.db.contact_messages.insert_one(contact_doc)
        
        # Send email notification to admin
        if self.email_service:
            try:
                await self.email_service.send_email(
                    to="admin@maestrohabitat.com",
                    subject=f"New Contact Form: {subject}",
                    html=f"""
                    <h2>New Contact Form Submission</h2>
                    <p><strong>From:</strong> {name} ({email})</p>
                    <p><strong>Subject:</strong> {subject}</p>
                    <p><strong>Message:</strong></p>
                    <p>{message}</p>
                    """
                )
            except Exception as e:
                logger.error(f"Failed to send contact notification email: {e}")
        
        return {"success": True, "contact_id": contact_id}
    
    async def get_admin_inbox(self, status: str = None, limit: int = 50) -> List[Dict]:
        """Get admin inbox messages"""
        query = {}
        if status:
            query["status"] = status
        
        messages = await self.db.contact_messages.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).to_list(limit)
        
        return messages
    
    async def update_contact_status(self, contact_id: str, status: str,
                                    admin_notes: str = None) -> Dict:
        """Update contact message status"""
        update_data = {
            "status": status,
            "updated_at": datetime.now(timezone.utc)
        }
        if admin_notes:
            update_data["admin_notes"] = admin_notes
        
        result = await self.db.contact_messages.update_one(
            {"contact_id": contact_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            return {"success": False, "error": "Contact message not found"}
        
        return {"success": True}
    
    # ============== ARCHIVED REPORT REQUESTS ==============
    async def request_archived_report(self, user_id: str, report_type: str,
                                      year: int, month: int = None) -> Dict:
        """Create a request for an archived report (>5 years old)"""
        request_id = f"req_{uuid.uuid4().hex[:12]}"
        
        request_doc = {
            "request_id": request_id,
            "user_id": user_id,
            "report_type": report_type,
            "year": year,
            "month": month,
            "status": "pending",
            "requested_at": datetime.now(timezone.utc)
        }
        
        await self.db.report_requests.insert_one(request_doc)
        
        # Create notification for admin
        await self.create_notification(
            user_id="admin",
            notification_type="report_request",
            title="Archived Report Request",
            message=f"User requested archived {report_type} report for {year}/{month or 'full year'}",
            data={"request_id": request_id}
        )
        
        # Notify user
        await self.create_notification(
            user_id=user_id,
            notification_type="report_request_submitted",
            title="Report Request Submitted",
            message=f"Your request for the {year} report has been submitted. You'll be notified when it's ready.",
            data={"request_id": request_id}
        )
        
        return {"success": True, "request_id": request_id}
