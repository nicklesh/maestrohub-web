"""
Referral Service for Maestro Habitat
Handles referral tracking, rewards, and credit management

Rewards System:
- Consumers: Get 1 FREE session after referred user completes 2 paid sessions
- Providers: Get 1-month platform fee waiver after referred user completes 2 paid sessions
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

# Constants
REQUIRED_SESSIONS_FOR_REWARD = 2  # Referred user must complete 2 paid sessions
PROVIDER_FEE_WAIVER_DAYS = 30  # 1 month fee waiver


class ReferralService:
    def __init__(self, db, notification_service=None, email_service=None):
        self.db = db
        self.notification_service = notification_service
        self.email_service = email_service
    
    # ============== REFERRAL CODE MANAGEMENT ==============
    async def get_or_create_referral_code(self, user_id: str) -> str:
        """Get existing or create new referral code for user"""
        user = await self.db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            return None
        
        # Check if user already has a referral code
        if user.get("referral_code"):
            return user["referral_code"]
        
        # Generate new unique code
        code = self._generate_unique_code(user.get("name", "USER"))
        
        # Update user with referral code
        await self.db.users.update_one(
            {"user_id": user_id},
            {"$set": {"referral_code": code, "referral_code_created_at": datetime.now(timezone.utc)}}
        )
        
        return code
    
    def _generate_unique_code(self, name: str) -> str:
        """Generate unique referral code based on name"""
        # Take first 3 letters of name (uppercase) + random suffix
        prefix = ''.join(c for c in name.upper() if c.isalpha())[:3] or "REF"
        suffix = uuid.uuid4().hex[:5].upper()
        return f"{prefix}{suffix}"
    
    async def find_referrer_by_code(self, code: str) -> Optional[Dict]:
        """Find user by referral code"""
        user = await self.db.users.find_one(
            {"referral_code": code.upper()},
            {"_id": 0, "password_hash": 0}
        )
        return user
    
    # ============== REFERRAL CREATION ==============
    async def create_referral(self, referrer_id: str, referred_id: str) -> Dict:
        """Create a new referral relationship"""
        # Validate users
        referrer = await self.db.users.find_one({"user_id": referrer_id}, {"_id": 0})
        referred = await self.db.users.find_one({"user_id": referred_id}, {"_id": 0})
        
        if not referrer or not referred:
            return {"success": False, "error": "User not found"}
        
        if referrer_id == referred_id:
            return {"success": False, "error": "Cannot refer yourself"}
        
        # Check if referral already exists
        existing = await self.db.referrals.find_one({
            "referred_id": referred_id
        })
        if existing:
            return {"success": False, "error": "User was already referred"}
        
        # Create referral record
        referral_id = f"ref_{uuid.uuid4().hex[:12]}"
        referral_doc = {
            "referral_id": referral_id,
            "referrer_id": referrer_id,
            "referrer_role": referrer.get("role", "consumer"),
            "referred_id": referred_id,
            "referred_role": referred.get("role", "consumer"),
            "status": "pending",  # pending -> qualified -> rewarded
            "referred_sessions_count": 0,
            "referrer_reward_type": self._get_reward_type(referrer.get("role")),
            "referrer_reward_status": "pending",
            "created_at": datetime.now(timezone.utc),
            "qualified_at": None,
            "rewarded_at": None
        }
        
        await self.db.referrals.insert_one(referral_doc)
        
        # Update referred user
        await self.db.users.update_one(
            {"user_id": referred_id},
            {"$set": {"referred_by": referrer_id, "referral_id": referral_id}}
        )
        
        logger.info(f"Created referral {referral_id}: {referrer_id} -> {referred_id}")
        
        return {
            "success": True,
            "referral_id": referral_id,
            "message": f"Referral recorded! You'll earn a reward after {REQUIRED_SESSIONS_FOR_REWARD} paid sessions."
        }
    
    def _get_reward_type(self, role: str) -> str:
        """Determine reward type based on referrer role"""
        if role == "provider" or role == "tutor":
            return "fee_waiver"  # 1-month platform fee waiver
        return "free_session"  # 1 free session credit
    
    # ============== SESSION TRACKING ==============
    async def record_referred_session(self, user_id: str, booking_id: str) -> Dict:
        """Record a completed paid session for a referred user"""
        # Find the referral where this user was referred
        referral = await self.db.referrals.find_one(
            {"referred_id": user_id, "status": {"$in": ["pending", "qualified"]}},
            {"_id": 0}
        )
        
        if not referral:
            return {"success": True, "message": "No active referral found"}
        
        # Increment session count
        new_count = referral.get("referred_sessions_count", 0) + 1
        
        update_data = {
            "referred_sessions_count": new_count,
            "last_session_at": datetime.now(timezone.utc)
        }
        
        # Check if qualification threshold reached
        if new_count >= REQUIRED_SESSIONS_FOR_REWARD and referral["status"] == "pending":
            update_data["status"] = "qualified"
            update_data["qualified_at"] = datetime.now(timezone.utc)
            
            # Apply reward automatically
            await self._apply_referrer_reward(referral)
            update_data["status"] = "rewarded"
            update_data["rewarded_at"] = datetime.now(timezone.utc)
            update_data["referrer_reward_status"] = "applied"
            
            logger.info(f"Referral {referral['referral_id']} qualified and rewarded!")
        
        await self.db.referrals.update_one(
            {"referral_id": referral["referral_id"]},
            {"$set": update_data}
        )
        
        return {
            "success": True,
            "sessions_completed": new_count,
            "sessions_required": REQUIRED_SESSIONS_FOR_REWARD,
            "is_qualified": new_count >= REQUIRED_SESSIONS_FOR_REWARD
        }
    
    async def _apply_referrer_reward(self, referral: Dict) -> None:
        """Apply the reward to the referrer"""
        referrer_id = referral["referrer_id"]
        reward_type = referral.get("referrer_reward_type", "free_session")
        
        if reward_type == "fee_waiver":
            # Provider: Apply 1-month fee waiver
            waiver_until = datetime.now(timezone.utc) + timedelta(days=PROVIDER_FEE_WAIVER_DAYS)
            
            await self.db.users.update_one(
                {"user_id": referrer_id},
                {
                    "$set": {
                        "fee_waiver_until": waiver_until,
                        "fee_waiver_reason": f"referral_{referral['referral_id']}"
                    }
                }
            )
            
            # Record the fee waiver
            waiver_doc = {
                "waiver_id": f"waiver_{uuid.uuid4().hex[:12]}",
                "user_id": referrer_id,
                "type": "referral_reward",
                "referral_id": referral["referral_id"],
                "waiver_days": PROVIDER_FEE_WAIVER_DAYS,
                "valid_until": waiver_until,
                "created_at": datetime.now(timezone.utc)
            }
            await self.db.fee_waivers.insert_one(waiver_doc)
            
            logger.info(f"Applied {PROVIDER_FEE_WAIVER_DAYS}-day fee waiver to provider {referrer_id}")
            
            # Notify referrer
            if self.notification_service:
                await self.notification_service.create_notification(
                    user_id=referrer_id,
                    notification_type="referral_reward",
                    title="Referral Reward Earned!",
                    message=f"Congratulations! Your referral has completed {REQUIRED_SESSIONS_FOR_REWARD} sessions. You've earned a 1-month platform fee waiver!",
                    data={"referral_id": referral["referral_id"], "reward_type": "fee_waiver"}
                )
        else:
            # Consumer: Add free session credit
            await self.db.users.update_one(
                {"user_id": referrer_id},
                {
                    "$inc": {"free_session_credits": 1},
                    "$push": {
                        "credit_history": {
                            "type": "referral_reward",
                            "referral_id": referral["referral_id"],
                            "credits": 1,
                            "created_at": datetime.now(timezone.utc)
                        }
                    }
                }
            )
            
            logger.info(f"Added 1 free session credit to consumer {referrer_id}")
            
            # Notify referrer
            if self.notification_service:
                await self.notification_service.create_notification(
                    user_id=referrer_id,
                    notification_type="referral_reward",
                    title="Free Session Earned!",
                    message=f"Congratulations! Your referral has completed {REQUIRED_SESSIONS_FOR_REWARD} sessions. You've earned 1 FREE session!",
                    data={"referral_id": referral["referral_id"], "reward_type": "free_session"}
                )
    
    # ============== USER QUERIES ==============
    async def get_user_referrals(self, user_id: str) -> Dict:
        """Get all referrals made by a user"""
        # Get user info
        user = await self.db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            return {"success": False, "error": "User not found"}
        
        # Get referrals where user is the referrer
        referrals = await self.db.referrals.find(
            {"referrer_id": user_id},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        
        # Enrich with referred user info
        enriched_referrals = []
        for ref in referrals:
            referred_user = await self.db.users.find_one(
                {"user_id": ref["referred_id"]},
                {"_id": 0, "password_hash": 0, "referral_code": 0}
            )
            enriched_referrals.append({
                **ref,
                "referred_name": referred_user.get("name", "Unknown") if referred_user else "Unknown",
                "referred_email": referred_user.get("email", "") if referred_user else "",
                "sessions_progress": f"{ref.get('referred_sessions_count', 0)}/{REQUIRED_SESSIONS_FOR_REWARD}"
            })
        
        # Calculate stats
        total_referrals = len(referrals)
        pending_referrals = len([r for r in referrals if r["status"] == "pending"])
        rewarded_referrals = len([r for r in referrals if r["status"] == "rewarded"])
        
        # Get user's referral code
        referral_code = await self.get_or_create_referral_code(user_id)
        
        return {
            "success": True,
            "referral_code": referral_code,
            "stats": {
                "total_referrals": total_referrals,
                "pending_referrals": pending_referrals,
                "rewarded_referrals": rewarded_referrals,
                "required_sessions": REQUIRED_SESSIONS_FOR_REWARD
            },
            "referrals": enriched_referrals,
            "reward_type": self._get_reward_type(user.get("role")),
            "reward_description": self._get_reward_description(user.get("role"))
        }
    
    def _get_reward_description(self, role: str) -> str:
        """Get human-readable reward description"""
        if role == "provider" or role == "tutor":
            return f"Earn a 1-month platform fee waiver for each referral who completes {REQUIRED_SESSIONS_FOR_REWARD} paid sessions"
        return f"Earn 1 FREE session for each referral who completes {REQUIRED_SESSIONS_FOR_REWARD} paid sessions"
    
    async def get_user_credits(self, user_id: str) -> Dict:
        """Get user's available credits from referrals"""
        user = await self.db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            return {"success": False, "error": "User not found"}
        
        free_sessions = user.get("free_session_credits", 0)
        fee_waiver_until = user.get("fee_waiver_until")
        
        has_active_waiver = False
        waiver_days_remaining = 0
        if fee_waiver_until:
            if isinstance(fee_waiver_until, str):
                fee_waiver_until = datetime.fromisoformat(fee_waiver_until.replace('Z', '+00:00'))
            if fee_waiver_until.tzinfo is None:
                fee_waiver_until = fee_waiver_until.replace(tzinfo=timezone.utc)
            if fee_waiver_until > datetime.now(timezone.utc):
                has_active_waiver = True
                waiver_days_remaining = (fee_waiver_until - datetime.now(timezone.utc)).days
        
        return {
            "success": True,
            "free_session_credits": free_sessions,
            "has_active_fee_waiver": has_active_waiver,
            "fee_waiver_days_remaining": waiver_days_remaining,
            "credit_history": user.get("credit_history", [])[-10:]  # Last 10 entries
        }
    
    async def use_free_session_credit(self, user_id: str, booking_id: str) -> Dict:
        """Use a free session credit for a booking"""
        user = await self.db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            return {"success": False, "error": "User not found"}
        
        free_sessions = user.get("free_session_credits", 0)
        if free_sessions < 1:
            return {"success": False, "error": "No free session credits available"}
        
        # Deduct credit
        await self.db.users.update_one(
            {"user_id": user_id},
            {
                "$inc": {"free_session_credits": -1},
                "$push": {
                    "credit_history": {
                        "type": "credit_used",
                        "booking_id": booking_id,
                        "credits": -1,
                        "created_at": datetime.now(timezone.utc)
                    }
                }
            }
        )
        
        logger.info(f"Used 1 free session credit for user {user_id}, booking {booking_id}")
        
        return {
            "success": True,
            "credits_remaining": free_sessions - 1,
            "message": "Free session credit applied!"
        }
    
    async def check_provider_fee_waiver(self, user_id: str) -> Dict:
        """Check if provider has active fee waiver"""
        user = await self.db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            return {"has_waiver": False}
        
        fee_waiver_until = user.get("fee_waiver_until")
        if not fee_waiver_until:
            return {"has_waiver": False}
        
        if isinstance(fee_waiver_until, str):
            fee_waiver_until = datetime.fromisoformat(fee_waiver_until.replace('Z', '+00:00'))
        if fee_waiver_until.tzinfo is None:
            fee_waiver_until = fee_waiver_until.replace(tzinfo=timezone.utc)
        
        if fee_waiver_until > datetime.now(timezone.utc):
            return {
                "has_waiver": True,
                "waiver_until": fee_waiver_until.isoformat(),
                "days_remaining": (fee_waiver_until - datetime.now(timezone.utc)).days
            }
        
        return {"has_waiver": False}
    
    # ============== ADMIN FUNCTIONS ==============
    async def get_all_referrals(self, status: str = None, limit: int = 100) -> List[Dict]:
        """Admin: Get all referrals in the system"""
        query = {}
        if status:
            query["status"] = status
        
        referrals = await self.db.referrals.find(
            query, {"_id": 0}
        ).sort("created_at", -1).to_list(limit)
        
        return referrals
    
    async def get_referral_stats(self) -> Dict:
        """Admin: Get referral system statistics"""
        total = await self.db.referrals.count_documents({})
        pending = await self.db.referrals.count_documents({"status": "pending"})
        qualified = await self.db.referrals.count_documents({"status": "qualified"})
        rewarded = await self.db.referrals.count_documents({"status": "rewarded"})
        
        # Count rewards by type
        fee_waivers = await self.db.referrals.count_documents({
            "status": "rewarded",
            "referrer_reward_type": "fee_waiver"
        })
        free_sessions = await self.db.referrals.count_documents({
            "status": "rewarded",
            "referrer_reward_type": "free_session"
        })
        
        return {
            "total_referrals": total,
            "pending": pending,
            "qualified": qualified,
            "rewarded": rewarded,
            "rewards_given": {
                "fee_waivers": fee_waivers,
                "free_sessions": free_sessions
            }
        }
