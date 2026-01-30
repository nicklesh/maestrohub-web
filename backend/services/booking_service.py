"""
Booking Service for Maestro Habitat
Handles booking holds, confirmations, cancellations, and booking management
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)


class BookingService:
    def __init__(self, db, email_service=None):
        self.db = db
        self.email_service = email_service
    
    async def create_hold(self, tutor_id: str, consumer_id: str, start_at: datetime, 
                         duration_minutes: int = 60) -> Dict:
        """Create a booking hold"""
        # Verify tutor exists and is available
        tutor = await self.db.tutors.find_one({"tutor_id": tutor_id}, {"_id": 0})
        if not tutor:
            return {"success": False, "error": "Coach not found"}
        
        if tutor.get("status") != "approved":
            return {"success": False, "error": "Coach is not available for booking"}
        
        end_at = start_at + timedelta(minutes=duration_minutes)
        
        # Check for conflicting bookings
        conflict = await self.db.bookings.find_one({
            "tutor_id": tutor_id,
            "status": {"$in": ["booked", "confirmed", "hold"]},
            "$or": [
                {"start_at": {"$lt": end_at, "$gte": start_at}},
                {"end_at": {"$gt": start_at, "$lte": end_at}},
                {"start_at": {"$lte": start_at}, "end_at": {"$gte": end_at}}
            ]
        })
        
        if conflict:
            return {"success": False, "error": "Time slot is not available"}
        
        # Check for existing holds
        existing_holds = await self.db.booking_holds.find_one({
            "tutor_id": tutor_id,
            "start_at": start_at,
            "expires_at": {"$gt": datetime.now(timezone.utc)}
        })
        
        if existing_holds and existing_holds.get("consumer_id") != consumer_id:
            return {"success": False, "error": "Time slot is currently held by another user"}
        
        hold_id = f"hold_{uuid.uuid4().hex[:12]}"
        hold_doc = {
            "hold_id": hold_id,
            "tutor_id": tutor_id,
            "consumer_id": consumer_id,
            "start_at": start_at,
            "end_at": end_at,
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=15),
            "created_at": datetime.now(timezone.utc)
        }
        
        await self.db.booking_holds.insert_one(hold_doc)
        
        return {
            "success": True,
            "hold": {
                "hold_id": hold_id,
                "tutor_id": tutor_id,
                "start_at": start_at.isoformat(),
                "end_at": end_at.isoformat(),
                "expires_at": hold_doc["expires_at"].isoformat(),
                "price": tutor.get("base_price", 0),
                "currency": "USD",
                "currency_symbol": "$"
            }
        }
    
    async def confirm_booking(self, hold_id: str, consumer_id: str, student_id: str,
                             intake_response: Dict, payment_method_id: str = None,
                             market_config: Dict = None) -> Dict:
        """Confirm a booking from a hold"""
        # Get hold
        hold = await self.db.booking_holds.find_one({"hold_id": hold_id}, {"_id": 0})
        if not hold:
            return {"success": False, "error": "Booking hold not found or expired"}
        
        if hold["consumer_id"] != consumer_id:
            return {"success": False, "error": "This hold belongs to another user"}
        
        if hold["expires_at"] < datetime.now(timezone.utc):
            return {"success": False, "error": "Booking hold has expired"}
        
        # Get tutor
        tutor = await self.db.tutors.find_one({"tutor_id": hold["tutor_id"]}, {"_id": 0})
        if not tutor:
            return {"success": False, "error": "Coach not found"}
        
        # Verify student belongs to consumer
        student = await self.db.students.find_one({"student_id": student_id, "user_id": consumer_id})
        if not student:
            return {"success": False, "error": "Student not found"}
        
        # Set market config defaults
        if not market_config:
            market_config = {
                "market_id": "US_USD",
                "currency": "USD",
                "currency_symbol": "$"
            }
        
        booking_id = f"booking_{uuid.uuid4().hex[:12]}"
        price = tutor.get("base_price", 0)
        
        booking_doc = {
            "booking_id": booking_id,
            "tutor_id": hold["tutor_id"],
            "consumer_id": consumer_id,
            "student_id": student_id,
            "market_id": market_config.get("market_id", "US_USD"),
            "currency": market_config.get("currency", "USD"),
            "start_at": hold["start_at"],
            "end_at": hold["end_at"],
            "status": "booked",
            "price_snapshot": price,
            "amount_cents": int(price * 100),
            "policy_snapshot": tutor.get("policies", {
                "cancel_window_hours": 24,
                "no_show_policy": "Full charge for no-shows",
                "late_arrival_policy": "Lesson time not extended"
            }),
            "intake_response": intake_response,
            "payment_id": f"pay_{uuid.uuid4().hex[:12]}",
            "created_at": datetime.now(timezone.utc)
        }
        
        await self.db.bookings.insert_one(booking_doc)
        
        # Delete the hold
        await self.db.booking_holds.delete_one({"hold_id": hold_id})
        
        return {
            "success": True,
            "booking_id": booking_id,
            "message": "Booking confirmed!"
        }
    
    async def cancel_booking(self, booking_id: str, user_id: str, is_tutor: bool = False) -> Dict:
        """Cancel a booking"""
        booking = await self.db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
        if not booking:
            return {"success": False, "error": "Booking not found"}
        
        if booking["status"] not in ["booked", "confirmed"]:
            return {"success": False, "error": "Cannot cancel this booking"}
        
        # Determine cancellation type
        if is_tutor:
            new_status = "canceled_by_provider"
        elif booking["consumer_id"] == user_id:
            new_status = "canceled_by_consumer"
        else:
            return {"success": False, "error": "Access denied"}
        
        await self.db.bookings.update_one(
            {"booking_id": booking_id},
            {"$set": {"status": new_status, "canceled_at": datetime.now(timezone.utc)}}
        )
        
        return {"success": True, "message": "Booking canceled"}
    
    async def get_bookings(self, user_id: str, role: str = "consumer", tutor_id: str = None) -> List[Dict]:
        """Get bookings for a user"""
        if role == "consumer":
            query = {"consumer_id": user_id}
        else:
            if not tutor_id:
                tutor = await self.db.tutors.find_one({"user_id": user_id}, {"_id": 0})
                if not tutor:
                    return []
                tutor_id = tutor["tutor_id"]
            query = {"tutor_id": tutor_id}
        
        bookings = await self.db.bookings.find(query, {"_id": 0}).sort("start_at", -1).to_list(100)
        
        # Enrich with tutor/student info
        results = []
        for b in bookings:
            tutor = await self.db.tutors.find_one({"tutor_id": b["tutor_id"]}, {"_id": 0})
            tutor_user = await self.db.users.find_one({"user_id": tutor["user_id"]}, {"_id": 0}) if tutor else None
            student = await self.db.students.find_one({"student_id": b["student_id"]}, {"_id": 0})
            
            # Get kid notifications
            kid_notifications = []
            if role == "consumer":
                kid_notifications = await self.db.kid_notifications.find(
                    {"booking_id": b["booking_id"]},
                    {"_id": 0}
                ).sort("sent_at", -1).to_list(5)
            
            results.append({
                **b,
                "tutor_name": tutor_user["name"] if tutor_user else "Unknown",
                "student_name": student["name"] if student else "Unknown",
                "currency": b.get("currency", "USD"),
                "currency_symbol": b.get("currency_symbol", "$"),
                "kid_notifications": kid_notifications
            })
        
        return results
    
    async def get_booking_detail(self, booking_id: str, user_id: str) -> Optional[Dict]:
        """Get detailed booking information"""
        booking = await self.db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
        if not booking:
            return None
        
        # Check access
        tutor = await self.db.tutors.find_one({"user_id": user_id}, {"_id": 0})
        if booking["consumer_id"] != user_id and (not tutor or tutor["tutor_id"] != booking["tutor_id"]):
            return None
        
        # Enrich with info
        booking_tutor = await self.db.tutors.find_one({"tutor_id": booking["tutor_id"]}, {"_id": 0})
        tutor_user = await self.db.users.find_one({"user_id": booking_tutor["user_id"]}, {"_id": 0}) if booking_tutor else None
        student = await self.db.students.find_one({"student_id": booking.get("student_id")}, {"_id": 0})
        
        # Get kid notifications
        kid_notifications = await self.db.kid_notifications.find(
            {"booking_id": booking_id},
            {"_id": 0}
        ).sort("sent_at", -1).to_list(10)
        
        # Get student notification settings
        student_notify_settings = None
        if student:
            student_notify_settings = {
                "notify_enabled": student.get("notify_upcoming_sessions", False),
                "email": student.get("email"),
                "phone": student.get("phone")
            }
        
        return {
            **booking,
            "tutor_name": tutor_user["name"] if tutor_user else "Unknown",
            "student_name": student["name"] if student else "Unknown",
            "currency": booking.get("currency", "USD"),
            "currency_symbol": booking.get("currency_symbol", "$"),
            "kid_notifications": kid_notifications,
            "student_notify_settings": student_notify_settings
        }
    
    async def add_review(self, booking_id: str, consumer_id: str, rating: int, comment: str = None) -> Dict:
        """Add a review for a booking"""
        booking = await self.db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
        if not booking:
            return {"success": False, "error": "Booking not found"}
        
        if booking["consumer_id"] != consumer_id:
            return {"success": False, "error": "Access denied"}
        
        if booking["status"] != "completed":
            return {"success": False, "error": "Can only review completed bookings"}
        
        # Check if already reviewed
        existing = await self.db.reviews.find_one({"booking_id": booking_id})
        if existing:
            return {"success": False, "error": "Already reviewed"}
        
        student = await self.db.students.find_one({"student_id": booking["student_id"]}, {"_id": 0})
        
        review_id = f"review_{uuid.uuid4().hex[:12]}"
        review_doc = {
            "review_id": review_id,
            "booking_id": booking_id,
            "tutor_id": booking["tutor_id"],
            "consumer_id": consumer_id,
            "student_name": student["name"] if student else "Anonymous",
            "rating": rating,
            "comment": comment,
            "created_at": datetime.now(timezone.utc)
        }
        
        await self.db.reviews.insert_one(review_doc)
        
        # Update tutor rating
        await self._update_tutor_rating(booking["tutor_id"])
        
        return {"success": True, "review_id": review_id}
    
    async def _update_tutor_rating(self, tutor_id: str):
        """Update tutor's average rating"""
        reviews = await self.db.reviews.find({"tutor_id": tutor_id}, {"_id": 0}).to_list(1000)
        if reviews:
            avg = sum(r["rating"] for r in reviews) / len(reviews)
            await self.db.tutors.update_one(
                {"tutor_id": tutor_id},
                {"$set": {"rating_avg": round(avg, 2), "rating_count": len(reviews)}}
            )
