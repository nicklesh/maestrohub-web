"""
Referral Service for Maestro Habitat
Handles referral rewards for parents (free session) and coaches (fee waiver)
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
import uuid

logger = logging.getLogger(__name__)

# Referral reward configuration
REFERRAL_CONFIG = {
    "sessions_required": 2,  # Number of paid sessions to qualify
    "consumer_reward": {
        "type": "free_session",
        "description": "1 free session credit",
        "value": 1  # Number of free sessions
    },
    "tutor_reward": {
        "type": "fee_waiver",
        "description": "1 month platform fee waiver",
        "value": 30  # Days of fee waiver
    }
}

class ReferralService:
    def __init__(self, db):
        self.db = db
    
    async def create_referral(self, referrer_id: str, referrer_role: str, 
                              referred_id: str, referred_role: str) -> Dict:
        """Create a new referral tracking record"""
        referral_id = f"ref_{uuid.uuid4().hex[:12]}"
        
        # Check for duplicate
        existing = await self.db.referrals.find_one({
            "referrer_id": referrer_id,
            "referred_id": referred_id
        })
        if existing:
            return {"status": "exists", "referral_id": existing["referral_id"]}
        
        referral_doc = {
            "referral_id": referral_id,
            "referrer_id": referrer_id,
            "referrer_role": referrer_role,
            "referred_id": referred_id,
            "referred_role": referred_role,
            "status": "pending",
            "sessions_completed": 0,
            "reward_type": REFERRAL_CONFIG[f"{referrer_role}_reward"]["type"],
            "reward_applied": False,
            "created_at": datetime.now(timezone.utc),
            "qualified_at": None,
            "rewarded_at": None
        }
        
        await self.db.referrals.insert_one(referral_doc)
        logger.info(f"Created referral {referral_id}: {referrer_id} -> {referred_id}")
        
        return {"status": "created", "referral_id": referral_id}
    
    async def record_session_completion(self, user_id: str, booking_id: str) -> Optional[Dict]:
        """
        Record a completed paid session and check if referral qualifies.
        Called after a successful payment/booking completion.
        """
        # Find any pending referrals where this user was referred
        referral = await self.db.referrals.find_one({
            "referred_id": user_id,
            "status": "pending"
        })
        
        if not referral:
            return None
        
        # Increment sessions completed
        new_count = referral["sessions_completed"] + 1
        update_data = {"sessions_completed": new_count}
        
        # Check if qualified (2 sessions completed)
        if new_count >= REFERRAL_CONFIG["sessions_required"]:
            update_data["status"] = "qualified"
            update_data["qualified_at"] = datetime.now(timezone.utc)
            
            # Apply reward
            await self._apply_reward(referral)
            update_data["status"] = "rewarded"
            update_data["reward_applied"] = True
            update_data["rewarded_at"] = datetime.now(timezone.utc)
        
        await self.db.referrals.update_one(
            {"referral_id": referral["referral_id"]},
            {"$set": update_data}
        )
        
        if new_count >= REFERRAL_CONFIG["sessions_required"]:
            logger.info(f"Referral {referral['referral_id']} qualified and rewarded!")
            return {
                "referral_id": referral["referral_id"],
                "status": "rewarded",
                "referrer_id": referral["referrer_id"],
                "reward_type": referral["reward_type"]
            }
        
        return {
            "referral_id": referral["referral_id"],
            "status": "pending",
            "sessions_completed": new_count,
            "sessions_required": REFERRAL_CONFIG["sessions_required"]
        }
    
    async def _apply_reward(self, referral: Dict) -> bool:
        """Apply the referral reward to the referrer"""
        referrer_id = referral["referrer_id"]
        referrer_role = referral["referrer_role"]
        reward_type = referral["reward_type"]
        
        try:
            if reward_type == "free_session":
                # Add free session credit to consumer
                credit_id = f"credit_{uuid.uuid4().hex[:12]}"
                await self.db.session_credits.insert_one({
                    "credit_id": credit_id,
                    "user_id": referrer_id,
                    "type": "referral_reward",
                    "sessions_remaining": REFERRAL_CONFIG["consumer_reward"]["value"],
                    "referral_id": referral["referral_id"],
                    "created_at": datetime.now(timezone.utc),
                    "expires_at": datetime.now(timezone.utc) + timedelta(days=365)  # 1 year expiry
                })
                
                # Send notification
                await self._send_reward_notification(
                    referrer_id,
                    "🎉 Free Session Earned!",
                    "Your referral completed 2 sessions! You've earned 1 free session credit."
                )
                
                logger.info(f"Applied free session credit {credit_id} to user {referrer_id}")
                
            elif reward_type == "fee_waiver":
                # Apply fee waiver to tutor
                waiver_id = f"waiver_{uuid.uuid4().hex[:12]}"
                waiver_days = REFERRAL_CONFIG["tutor_reward"]["value"]
                
                # Check if tutor already has an active waiver
                existing_waiver = await self.db.fee_waivers.find_one({
                    "tutor_id": referrer_id,
                    "expires_at": {"$gt": datetime.now(timezone.utc)}
                })
                
                if existing_waiver:
                    # Extend existing waiver
                    new_expiry = existing_waiver["expires_at"] + timedelta(days=waiver_days)
                    await self.db.fee_waivers.update_one(
                        {"waiver_id": existing_waiver["waiver_id"]},
                        {"$set": {"expires_at": new_expiry}}
                    )
                else:
                    # Create new waiver
                    await self.db.fee_waivers.insert_one({
                        "waiver_id": waiver_id,
                        "tutor_id": referrer_id,
                        "type": "referral_reward",
                        "referral_id": referral["referral_id"],
                        "starts_at": datetime.now(timezone.utc),
                        "expires_at": datetime.now(timezone.utc) + timedelta(days=waiver_days),
                        "created_at": datetime.now(timezone.utc)
                    })
                
                # Send notification
                await self._send_reward_notification(
                    referrer_id,
                    "🎉 Platform Fee Waived!",
                    f"Your referral completed 2 sessions! You've earned {waiver_days} days of platform fee waiver."
                )
                
                logger.info(f"Applied fee waiver to tutor {referrer_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to apply reward for referral {referral['referral_id']}: {e}")
            return False
    
    async def _send_reward_notification(self, user_id: str, title: str, message: str):
        """Send notification about reward"""
        await self.db.notifications.insert_one({
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "type": "referral_reward",
            "title": title,
            "message": message,
            "is_read": False,
            "created_at": datetime.now(timezone.utc)
        })
    
    async def get_user_referrals(self, user_id: str) -> Dict:
        """Get referral stats and list for a user"""
        referrals = await self.db.referrals.find(
            {"referrer_id": user_id},
            {"_id": 0}
        ).sort("created_at", -1).to_list(50)
        
        # Calculate stats
        total = len(referrals)
        pending = len([r for r in referrals if r["status"] == "pending"])
        qualified = len([r for r in referrals if r["status"] in ["qualified", "rewarded"]])
        
        return {
            "referrals": referrals,
            "stats": {
                "total": total,
                "pending": pending,
                "qualified": qualified,
                "sessions_required": REFERRAL_CONFIG["sessions_required"]
            }
        }
    
    async def get_referral_code(self, user_id: str) -> str:
        """Generate or get referral code for user"""
        # Simple referral code based on user_id
        return user_id[-8:].upper()
    
    async def find_referrer_by_code(self, code: str) -> Optional[Dict]:
        """Find referrer by referral code"""
        # Search for user whose ID ends with this code
        users = await self.db.users.find({}, {"_id": 0, "user_id": 1, "role": 1, "name": 1}).to_list(None)
        
        for user in users:
            if user["user_id"][-8:].upper() == code.upper():
                return user
        
        return None
    
    async def check_user_credits(self, user_id: str) -> Dict:
        """Check user's available session credits"""
        credits = await self.db.session_credits.find({
            "user_id": user_id,
            "sessions_remaining": {"$gt": 0},
            "expires_at": {"$gt": datetime.now(timezone.utc)}
        }).to_list(10)
        
        total_sessions = sum(c.get("sessions_remaining", 0) for c in credits)
        
        return {
            "total_free_sessions": total_sessions,
            "credits": [{
                "credit_id": c["credit_id"],
                "sessions_remaining": c["sessions_remaining"],
                "expires_at": c["expires_at"].isoformat() if c.get("expires_at") else None
            } for c in credits]
        }
    
    async def use_session_credit(self, user_id: str) -> Optional[str]:
        """Use one session credit if available. Returns credit_id if used."""
        credit = await self.db.session_credits.find_one({
            "user_id": user_id,
            "sessions_remaining": {"$gt": 0},
            "expires_at": {"$gt": datetime.now(timezone.utc)}
        }, sort=[("expires_at", 1)])  # Use oldest first
        
        if not credit:
            return None
        
        await self.db.session_credits.update_one(
            {"credit_id": credit["credit_id"]},
            {"$inc": {"sessions_remaining": -1}}
        )
        
        return credit["credit_id"]
    
    async def check_tutor_fee_waiver(self, tutor_id: str) -> Optional[Dict]:
        """Check if tutor has active fee waiver"""
        waiver = await self.db.fee_waivers.find_one({
            "tutor_id": tutor_id,
            "expires_at": {"$gt": datetime.now(timezone.utc)}
        }, {"_id": 0})
        
        return waiver
