"""
Profile Service for Maestro Habitat
Handles user profile management, settings, and preferences
"""
import uuid
import logging
import re
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from bson import ObjectId

logger = logging.getLogger(__name__)


class ProfileService:
    def __init__(self, db):
        self.db = db
    
    async def get_user_profile(self, user_id: str) -> Optional[Dict]:
        """Get complete user profile"""
        user = await self.db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
        if not user:
            return None
        
        # If user is also a tutor, get tutor profile
        if user.get("role") == "tutor":
            tutor_profile = await self.db.tutors.find_one({"user_id": user_id}, {"_id": 0})
            if tutor_profile:
                user["tutor_profile"] = tutor_profile
        
        return user
    
    async def update_user_profile(self, user_id: str, update_data: Dict) -> Dict:
        """Update user profile fields"""
        allowed_fields = [
            "name", "phone", "bio", "timezone", "avatar_url",
            "notification_preferences", "language", "market_id"
        ]
        
        update = {}
        for field in allowed_fields:
            if field in update_data:
                # Sanitize input
                value = update_data[field]
                if isinstance(value, str):
                    value = self._sanitize_input(value)
                update[field] = value
        
        if not update:
            return {"success": False, "error": "No valid fields to update"}
        
        update["updated_at"] = datetime.now(timezone.utc)
        
        result = await self.db.users.update_one(
            {"user_id": user_id},
            {"$set": update}
        )
        
        if result.modified_count > 0:
            logger.info(f"Profile updated for user {user_id}")
            return {"success": True, "updated_fields": list(update.keys())}
        
        return {"success": False, "error": "Profile not found"}
    
    async def get_notification_preferences(self, user_id: str) -> Dict:
        """Get user notification preferences"""
        user = await self.db.users.find_one(
            {"user_id": user_id},
            {"notification_preferences": 1, "_id": 0}
        )
        
        defaults = {
            "email_notifications": True,
            "push_notifications": True,
            "sms_notifications": False,
            "booking_reminders": True,
            "marketing_emails": False,
            "session_reminders_24h": True,
            "session_reminders_1h": True,
        }
        
        if user and "notification_preferences" in user:
            return {**defaults, **user["notification_preferences"]}
        
        return defaults
    
    async def update_notification_preferences(self, user_id: str, preferences: Dict) -> Dict:
        """Update notification preferences"""
        allowed_keys = [
            "email_notifications", "push_notifications", "sms_notifications",
            "booking_reminders", "marketing_emails", "session_reminders_24h",
            "session_reminders_1h"
        ]
        
        update = {}
        for key in allowed_keys:
            if key in preferences:
                update[f"notification_preferences.{key}"] = bool(preferences[key])
        
        if not update:
            return {"success": False, "error": "No valid preferences to update"}
        
        result = await self.db.users.update_one(
            {"user_id": user_id},
            {"$set": update}
        )
        
        return {"success": True if result.modified_count > 0 else False}
    
    async def get_user_settings(self, user_id: str) -> Dict:
        """Get all user settings"""
        user = await self.db.users.find_one(
            {"user_id": user_id},
            {
                "notification_preferences": 1,
                "language": 1,
                "timezone": 1,
                "theme": 1,
                "auto_pay": 1,
                "_id": 0
            }
        )
        
        if not user:
            return {}
        
        return {
            "notification_preferences": user.get("notification_preferences", {}),
            "language": user.get("language", "en_US"),
            "timezone": user.get("timezone", "America/New_York"),
            "theme": user.get("theme", "light"),
            "auto_pay": user.get("auto_pay", True)
        }
    
    async def update_user_settings(self, user_id: str, settings: Dict) -> Dict:
        """Update user settings"""
        update = {}
        
        if "language" in settings:
            update["language"] = settings["language"]
        
        if "timezone" in settings:
            update["timezone"] = settings["timezone"]
        
        if "theme" in settings:
            update["theme"] = settings["theme"]
        
        if "auto_pay" in settings:
            update["auto_pay"] = bool(settings["auto_pay"])
        
        if not update:
            return {"success": False, "error": "No valid settings to update"}
        
        update["updated_at"] = datetime.now(timezone.utc)
        
        result = await self.db.users.update_one(
            {"user_id": user_id},
            {"$set": update}
        )
        
        return {"success": result.modified_count > 0}
    
    async def get_kids(self, parent_user_id: str) -> List[Dict]:
        """Get all children for a parent"""
        user = await self.db.users.find_one(
            {"user_id": parent_user_id},
            {"children": 1, "_id": 0}
        )
        
        return user.get("children", []) if user else []
    
    async def add_kid(self, parent_user_id: str, kid_data: Dict) -> Dict:
        """Add a child to parent profile"""
        kid_id = f"kid_{uuid.uuid4().hex[:12]}"
        
        kid = {
            "kid_id": kid_id,
            "name": self._sanitize_input(kid_data.get("name", "")),
            "age": kid_data.get("age"),
            "grade": kid_data.get("grade"),
            "email": kid_data.get("email"),
            "phone": kid_data.get("phone"),
            "send_reminders": kid_data.get("send_reminders", False),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        result = await self.db.users.update_one(
            {"user_id": parent_user_id},
            {"$push": {"children": kid}}
        )
        
        if result.modified_count > 0:
            return {"success": True, "kid": kid}
        
        return {"success": False, "error": "Failed to add child"}
    
    async def update_kid(self, parent_user_id: str, kid_id: str, update_data: Dict) -> Dict:
        """Update child information"""
        update = {}
        
        if "name" in update_data:
            update["children.$.name"] = self._sanitize_input(update_data["name"])
        if "age" in update_data:
            update["children.$.age"] = update_data["age"]
        if "grade" in update_data:
            update["children.$.grade"] = update_data["grade"]
        if "email" in update_data:
            update["children.$.email"] = update_data["email"]
        if "phone" in update_data:
            update["children.$.phone"] = update_data["phone"]
        if "send_reminders" in update_data:
            update["children.$.send_reminders"] = bool(update_data["send_reminders"])
        
        if not update:
            return {"success": False, "error": "No valid fields to update"}
        
        result = await self.db.users.update_one(
            {"user_id": parent_user_id, "children.kid_id": kid_id},
            {"$set": update}
        )
        
        return {"success": result.modified_count > 0}
    
    async def remove_kid(self, parent_user_id: str, kid_id: str) -> Dict:
        """Remove a child from parent profile"""
        result = await self.db.users.update_one(
            {"user_id": parent_user_id},
            {"$pull": {"children": {"kid_id": kid_id}}}
        )
        
        return {"success": result.modified_count > 0}
    
    async def get_tutor_profile(self, tutor_id: str) -> Optional[Dict]:
        """Get tutor public profile"""
        tutor = await self.db.tutors.find_one({"tutor_id": tutor_id}, {"_id": 0})
        if not tutor:
            return None
        
        # Get user info
        user = await self.db.users.find_one(
            {"user_id": tutor["user_id"]},
            {"_id": 0, "password_hash": 0}
        )
        
        if user:
            tutor["user_name"] = user.get("name")
            tutor["user_email"] = user.get("email")
        
        # Get review stats
        reviews = await self.db.reviews.find(
            {"tutor_id": tutor_id},
            {"rating": 1, "_id": 0}
        ).to_list(1000)
        
        if reviews:
            tutor["rating"] = round(sum(r["rating"] for r in reviews) / len(reviews), 1)
            tutor["review_count"] = len(reviews)
        else:
            tutor["rating"] = 0
            tutor["review_count"] = 0
        
        return tutor
    
    async def update_tutor_profile(self, user_id: str, update_data: Dict) -> Dict:
        """Update tutor profile"""
        allowed_fields = [
            "bio", "subjects", "hourly_rate", "years_experience",
            "cancellation_policy", "no_show_policy", "session_duration_options"
        ]
        
        update = {}
        for field in allowed_fields:
            if field in update_data:
                value = update_data[field]
                if isinstance(value, str):
                    value = self._sanitize_input(value)
                update[field] = value
        
        if not update:
            return {"success": False, "error": "No valid fields to update"}
        
        update["updated_at"] = datetime.now(timezone.utc)
        
        result = await self.db.tutors.update_one(
            {"user_id": user_id},
            {"$set": update}
        )
        
        if result.modified_count > 0:
            logger.info(f"Tutor profile updated for user {user_id}")
            return {"success": True}
        
        return {"success": False, "error": "Tutor profile not found"}
    
    def _sanitize_input(self, text: str) -> str:
        """Basic input sanitization"""
        if not text:
            return text
        
        # Remove potential HTML/script tags
        text = re.sub(r'<[^>]*>', '', text)
        # Remove dangerous characters
        text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', text)
        
        return text.strip()
