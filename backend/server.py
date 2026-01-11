from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query
from fastapi.security import HTTPBearer
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import bcrypt
import jwt
import io

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'maestrohub')]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'maestrohub-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_DAYS = 7

# Stripe Config (placeholder)
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', 'sk_test_placeholder')
STRIPE_PUBLISHABLE_KEY = os.environ.get('STRIPE_PUBLISHABLE_KEY', 'pk_test_placeholder')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', 'whsec_placeholder')
PLATFORM_FEE_PERCENT = float(os.environ.get('PLATFORM_FEE_PERCENT', '10'))  # 10% platform fee

# Resend Config (placeholder)
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', 're_placeholder')

# ============== FEATURE FLAGS ==============
FEATURE_FLAGS = {
    "CROSS_BORDER_ONLINE_ENABLED": False,
    "MARKET_SWITCHING_ENABLED": True,
    "IN_MARKET_ONLY_BOOKING_ENFORCED": True,
}

# ============== MARKET CONFIGURATION ==============
MARKETS_CONFIG = {
    "US_USD": {
        "market_id": "US_USD",
        "country": "US",
        "currency": "USD",
        "currency_symbol": "$",
        "default_timezone": "America/New_York",
        "is_enabled": True,
        "payment_provider_key": "stripe_us",
        "min_price": 10,
        "max_price": 500,
    },
    "IN_INR": {
        "market_id": "IN_INR",
        "country": "IN",
        "currency": "INR",
        "currency_symbol": "₹",
        "default_timezone": "Asia/Kolkata",
        "is_enabled": True,
        "payment_provider_key": "stripe_in",
        "min_price": 200,
        "max_price": 10000,
    }
}

# Country to Market mapping
COUNTRY_TO_MARKET = {
    "US": "US_USD",
    "IN": "IN_INR",
    # Default fallback
    "default": "US_USD"
}

# Create the main app
app = FastAPI(title="Maestro Hub API", version="1.0.0")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============== MODELS ==============

# Market Models
class Market(BaseModel):
    market_id: str  # US_USD, IN_INR
    country: str  # ISO code: US, IN
    currency: str  # ISO code: USD, INR
    currency_symbol: str  # $, ₹
    default_timezone: str  # IANA timezone
    is_enabled: bool = True
    payment_provider_key: str
    min_price: float
    max_price: float

class PricingPolicy(BaseModel):
    policy_id: str
    market_id: str
    trial_days: int = 90
    trial_free_until_first_booking: bool = True
    nsf_amount_cents: int = 500  # No-show fee
    provider_fee_percent: float = 0.0  # Platform fee percentage
    consumer_fee_percent: float = 0.0
    pro_subscription_price_cents: Optional[int] = None
    created_at: datetime
    updated_at: datetime

class MarketSetRequest(BaseModel):
    market_id: str

class ProviderMarketSetRequest(BaseModel):
    payout_country: str  # US or IN

class DeviceInfo(BaseModel):
    device_id: str
    device_name: Optional[str] = None
    platform: Optional[str] = None
    model: Optional[str] = None
    os_version: Optional[str] = None

class UserBase(BaseModel):
    email: EmailStr
    name: str
    picture: Optional[str] = None

class UserCreate(UserBase):
    password: Optional[str] = None
    role: str = "consumer"
    device: Optional[DeviceInfo] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str
    device: Optional[DeviceInfo] = None

class User(UserBase):
    user_id: str
    role: str
    market_id: Optional[str] = None  # US_USD, IN_INR
    country: Optional[str] = None  # ISO country code
    timezone: Optional[str] = None  # IANA timezone
    devices: List[DeviceInfo] = []
    created_at: Optional[datetime] = None

class StudentCreate(BaseModel):
    name: str
    age: Optional[int] = None
    grade: Optional[str] = None
    notes: Optional[str] = None
    email: Optional[EmailStr] = None  # Kid's email for sending schedules
    auto_send_schedule: bool = False  # Auto-send quarterly schedules

class Student(StudentCreate):
    student_id: str
    user_id: str
    created_at: Optional[datetime] = None

class StudentUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    grade: Optional[str] = None
    notes: Optional[str] = None
    email: Optional[EmailStr] = None
    auto_send_schedule: Optional[bool] = None

class TutorPolicies(BaseModel):
    cancel_window_hours: int = 24
    no_show_policy: str = "Full charge for no-shows"
    late_arrival_policy: str = "Lesson time not extended"

class TutorProfileCreate(BaseModel):
    bio: str
    categories: List[str]  # academic, music, activities
    subjects: List[str]
    levels: Optional[List[str]] = []  # elementary, middle_school, high_school, college, adult
    modality: List[str]  # online, in_person
    service_area_radius: Optional[int] = 10  # miles
    base_price: float
    duration_minutes: int = 60
    payout_country: Optional[str] = "US"  # ISO code: US, IN
    policies: TutorPolicies = TutorPolicies()

class TutorProfile(TutorProfileCreate):
    tutor_id: str
    user_id: str
    market_id: Optional[str] = None  # US_USD, IN_INR - determined by payout_country
    timezone: Optional[str] = None  # IANA timezone
    base_country: Optional[str] = None
    base_state: Optional[str] = None
    base_city: Optional[str] = None
    status: str = "pending"  # pending, approved, suspended
    is_published: bool = False
    trial_start_at: Optional[datetime] = None
    rating_avg: float = 0.0
    rating_count: int = 0
    created_at: datetime

class AvailabilityRule(BaseModel):
    rule_id: str = Field(default_factory=lambda: f"rule_{uuid.uuid4().hex[:12]}")
    tutor_id: str
    day_of_week: int  # 0=Sunday, 1=Monday, etc.
    start_time: str  # HH:MM format
    end_time: str
    timezone: str = "America/New_York"

class AvailabilityRuleCreate(BaseModel):
    day_of_week: int  # 0=Sunday, 1=Monday, etc.
    start_time: str  # HH:MM format
    end_time: str
    timezone: str = "America/New_York"

class VacationPeriod(BaseModel):
    vacation_id: str = Field(default_factory=lambda: f"vac_{uuid.uuid4().hex[:12]}")
    tutor_id: str
    start_date: str  # YYYY-MM-DD
    end_date: str  # YYYY-MM-DD
    reason: Optional[str] = None

class VacationPeriodCreate(BaseModel):
    start_date: str
    end_date: str
    reason: Optional[str] = None

class AvailabilityException(BaseModel):
    exception_id: str = Field(default_factory=lambda: f"exc_{uuid.uuid4().hex[:12]}")
    tutor_id: str
    date: str  # YYYY-MM-DD
    is_available: bool = False  # False = blocked, True = extra availability
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    reason: Optional[str] = None

class BookingHoldCreate(BaseModel):
    tutor_id: str
    start_at: datetime
    duration_minutes: int = 60

class BookingHold(BaseModel):
    hold_id: str
    tutor_id: str
    consumer_id: str
    start_at: datetime
    end_at: datetime
    expires_at: datetime
    created_at: datetime

class IntakeResponse(BaseModel):
    goals: str
    current_level: str
    notes: Optional[str] = None
    policy_acknowledged: bool = True

class BookingCreate(BaseModel):
    hold_id: str
    student_id: str
    intake: IntakeResponse
    payment_method_id: Optional[str] = None  # For Stripe

class Booking(BaseModel):
    booking_id: str
    tutor_id: str
    consumer_id: str
    student_id: str
    market_id: str  # Market at time of booking
    currency: str  # USD, INR
    start_at: datetime
    end_at: datetime
    status: str  # hold, booked, confirmed, completed, canceled_by_consumer, canceled_by_provider
    price_snapshot: float
    amount_cents: int  # Price in minor units for currency precision
    policy_snapshot: Dict[str, Any]
    pricing_policy_snapshot: Optional[Dict[str, Any]] = None  # Snapshot of market pricing policy
    intake_response: Optional[IntakeResponse] = None
    payment_id: Optional[str] = None
    created_at: datetime

class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None

class Review(ReviewCreate):
    review_id: str
    booking_id: str
    tutor_id: str
    consumer_id: str
    student_name: str
    created_at: datetime

class ProviderFeeEvent(BaseModel):
    event_id: str
    tutor_id: str
    event_type: str  # NSF, SUBSCRIPTION, ADJUSTMENT
    booking_id: Optional[str] = None
    student_id: Optional[str] = None
    amount_cents: int
    currency: str = "USD"
    status: str  # PENDING, CHARGED, WAIVED, CAPPED
    reason: Optional[str] = None
    created_at: datetime

# ============== AUTH HELPERS ==============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_jwt_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("user_id")
    except:
        return None

async def get_current_user(request: Request) -> Optional[User]:
    # Check cookie first
    session_token = request.cookies.get("session_token")
    
    # Then check Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        return None
    
    # Check if it's a JWT token
    user_id = decode_jwt_token(session_token)
    if user_id:
        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if user_doc:
            return User(**user_doc)
    
    # Check session in database
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if session:
        expires_at = session["expires_at"]
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at > datetime.now(timezone.utc):
            user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
            if user_doc:
                return User(**user_doc)
    
    return None

async def require_auth(request: Request) -> User:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

async def require_tutor(request: Request) -> User:
    user = await require_auth(request)
    if user.role not in ["tutor", "admin"]:
        raise HTTPException(status_code=403, detail="Tutor access required")
    return user

async def require_admin(request: Request) -> User:
    user = await require_auth(request)
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register")
async def register(data: UserCreate, response: Response):
    # Check if email exists
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": data.email,
        "name": data.name,
        "picture": data.picture,
        "role": data.role,
        "password_hash": hash_password(data.password) if data.password else None,
        "devices": [data.device.dict()] if data.device else [],
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(user_doc)
    
    # Create JWT token
    token = create_jwt_token(user_id)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60
    )
    
    return {"user_id": user_id, "token": token, "role": data.role}

@api_router.post("/auth/login")
async def login(data: UserLogin, response: Response):
    user_doc = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user_doc:
        logger.error(f"Login failed: user not found for {data.email}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    logger.info(f"Login attempt for {data.email}, has password_hash: {'password_hash' in user_doc}, role: {user_doc.get('role')}")
    
    if not user_doc.get("password_hash"):
        logger.error(f"Login failed: no password_hash for {data.email}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(data.password, user_doc["password_hash"]):
        logger.error(f"Login failed: password mismatch for {data.email}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Update device if provided
    if data.device:
        devices = user_doc.get("devices", [])
        device_exists = any(d.get("device_id") == data.device.device_id for d in devices)
        if not device_exists:
            devices.append(data.device.dict())
            await db.users.update_one({"user_id": user_doc["user_id"]}, {"$set": {"devices": devices}})
    
    token = create_jwt_token(user_doc["user_id"])
    
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60
    )
    
    # Fetch fresh user data to ensure we return correct role
    fresh_user = await db.users.find_one({"email": data.email}, {"_id": 0})
    user_role = fresh_user.get("role", "consumer") if fresh_user else "consumer"
    logger.info(f"Login success for {data.email}, returning role: {user_role}")
    
    return {"user_id": user_doc["user_id"], "token": token, "role": user_role}

@api_router.post("/auth/google/callback")
async def google_callback(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    device = body.get("device")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required")
    
    # Exchange session_id for user data
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        user_data = resp.json()
    
    # Check if user exists
    existing = await db.users.find_one({"email": user_data["email"]}, {"_id": 0})
    
    if existing:
        user_id = existing["user_id"]
        # Update device if provided
        if device:
            devices = existing.get("devices", [])
            device_exists = any(d.get("device_id") == device.get("device_id") for d in devices)
            if not device_exists:
                devices.append(device)
                await db.users.update_one({"user_id": user_id}, {"$set": {"devices": devices}})
        role = existing["role"]
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": user_data["email"],
            "name": user_data["name"],
            "picture": user_data.get("picture"),
            "role": "consumer",
            "password_hash": None,
            "devices": [device] if device else [],
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(user_doc)
        role = "consumer"
    
    # Store session
    session_token = user_data.get("session_token", create_jwt_token(user_id))
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    })
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 60 * 60
    )
    
    return {"user_id": user_id, "token": session_token, "role": role}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token")
    return {"message": "Logged out"}

@api_router.put("/auth/role")
async def update_role(request: Request, new_role: str = Query(...)):
    user = await require_auth(request)
    if new_role not in ["consumer", "tutor"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    await db.users.update_one({"user_id": user.user_id}, {"$set": {"role": new_role}})
    return {"message": "Role updated", "role": new_role}

# ============== PROFILE MANAGEMENT ==============

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

@api_router.put("/profile")
async def update_profile(data: ProfileUpdate, request: Request):
    """Update user profile (name, phone)"""
    user = await require_auth(request)
    
    update_data = {}
    if data.name:
        update_data["name"] = data.name
    if data.phone:
        update_data["phone"] = data.phone
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    await db.users.update_one({"user_id": user.user_id}, {"$set": update_data})
    
    # Get updated user
    updated = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "password_hash": 0})
    return updated

@api_router.post("/profile/change-password")
async def change_password(data: PasswordChange, request: Request):
    """Change user password"""
    user = await require_auth(request)
    
    # Get current user with password
    user_doc = await db.users.find_one({"user_id": user.user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify current password
    if not user_doc.get("password_hash"):
        raise HTTPException(status_code=400, detail="Account uses social login, cannot change password")
    
    if not verify_password(data.current_password, user_doc["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Validate new password
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    # Update password
    new_hash = hash_password(data.new_password)
    await db.users.update_one({"user_id": user.user_id}, {"$set": {"password_hash": new_hash}})
    
    return {"success": True, "message": "Password changed successfully"}

# ============== BILLING & PAYMENT METHODS ==============

class PaymentMethodAdd(BaseModel):
    stripe_payment_method_id: str
    is_default: bool = False

class AutoPaySettings(BaseModel):
    enabled: bool
    day_of_month: int = 1  # 1-28

@api_router.get("/billing")
async def get_billing_info(request: Request):
    """Get comprehensive billing information"""
    user = await require_auth(request)
    
    # Get user's payment methods (if connected to Stripe)
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    stripe_customer_id = user_doc.get("stripe_customer_id")
    
    # Get pending payments
    pending_payments = await db.payments.find({
        "user_id": user.user_id,
        "status": "pending"
    }, {"_id": 0}).to_list(100)
    
    pending_balance = sum(p.get("amount", 0) for p in pending_payments)
    
    # Get auto-pay settings
    auto_pay = user_doc.get("auto_pay_settings", {"enabled": False})
    
    # Calculate next auto-pay (if enabled)
    next_auto_pay = None
    if auto_pay.get("enabled") and pending_balance > 0:
        today = datetime.now(timezone.utc)
        day = auto_pay.get("day_of_month", 1)
        if today.day > day:
            # Next month
            if today.month == 12:
                next_auto_pay = datetime(today.year + 1, 1, day, tzinfo=timezone.utc)
            else:
                next_auto_pay = datetime(today.year, today.month + 1, day, tzinfo=timezone.utc)
        else:
            next_auto_pay = datetime(today.year, today.month, day, tzinfo=timezone.utc)
    
    return {
        "stripe_connected": bool(stripe_customer_id),
        "stripe_customer_id": stripe_customer_id,
        "pending_balance": pending_balance,
        "pending_payments": pending_payments,
        "auto_pay": {
            "enabled": auto_pay.get("enabled", False),
            "day_of_month": auto_pay.get("day_of_month", 1),
            "next_auto_pay_date": next_auto_pay.isoformat() if next_auto_pay else None,
            "next_auto_pay_amount": pending_balance if auto_pay.get("enabled") else 0
        },
        "payment_methods": user_doc.get("payment_methods", [])
    }

@api_router.post("/billing/setup-stripe")
async def setup_stripe_billing(request: Request):
    """Create Stripe customer and return setup URL"""
    user = await require_auth(request)
    
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    
    if user_doc.get("stripe_customer_id"):
        return {
            "already_setup": True,
            "stripe_customer_id": user_doc.get("stripe_customer_id"),
            "message": "Stripe account already connected"
        }
    
    # In production, create actual Stripe customer
    # For now, simulate customer creation
    stripe_customer_id = f"cus_{uuid.uuid4().hex[:14]}"
    
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {
            "stripe_customer_id": stripe_customer_id,
            "stripe_setup_at": datetime.now(timezone.utc)
        }}
    )
    
    return {
        "success": True,
        "stripe_customer_id": stripe_customer_id,
        "message": "Stripe billing setup complete"
    }

@api_router.put("/billing/auto-pay")
async def update_auto_pay_settings(data: AutoPaySettings, request: Request):
    """Update auto-pay settings"""
    user = await require_auth(request)
    
    if data.day_of_month < 1 or data.day_of_month > 28:
        raise HTTPException(status_code=400, detail="Day must be between 1 and 28")
    
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {
            "auto_pay_settings": {
                "enabled": data.enabled,
                "day_of_month": data.day_of_month
            }
        }}
    )
    
    return {"success": True, "auto_pay": data.dict()}

# ============== CONSUMER INVITES TO PROVIDERS ==============

class ConsumerInviteCreate(BaseModel):
    tutor_email: EmailStr
    tutor_name: Optional[str] = None
    message: Optional[str] = None

@api_router.post("/consumer/invite-provider")
async def consumer_invite_provider(data: ConsumerInviteCreate, request: Request):
    """Consumer invites a provider with one free session credit"""
    user = await require_auth(request)
    
    # Check if invite already exists
    existing = await db.consumer_invites.find_one({
        "consumer_id": user.user_id,
        "tutor_email": data.tutor_email.lower(),
        "status": {"$in": ["pending", "accepted"]}
    })
    if existing:
        raise HTTPException(status_code=400, detail="You've already invited this provider")
    
    invite_id = f"cinv_{uuid.uuid4().hex[:12]}"
    
    invite_doc = {
        "invite_id": invite_id,
        "consumer_id": user.user_id,
        "consumer_name": user.name,
        "tutor_email": data.tutor_email.lower(),
        "tutor_name": data.tutor_name,
        "message": data.message or f"Hi! I'd like to invite you to join Maestro Hub as a tutor. You'll get one free session to try out the platform!",
        "status": "pending",
        "free_session_credit": True,  # Auto credit for first session
        "credit_amount": 50.00,  # Default credit amount
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=30)
    }
    
    await db.consumer_invites.insert_one(invite_doc)
    
    # Check if tutor already exists
    existing_tutor = await db.users.find_one({"email": data.tutor_email.lower()}, {"_id": 0})
    if existing_tutor:
        # Create notification for tutor
        await db.notifications.insert_one({
            "notification_id": f"notif_{uuid.uuid4().hex[:8]}",
            "user_id": existing_tutor["user_id"],
            "type": "consumer_invite",
            "title": "New Student Invitation",
            "message": f"{user.name} has invited you to connect! You'll receive a free session credit.",
            "data": {"invite_id": invite_id, "consumer_id": user.user_id},
            "read": False,
            "created_at": datetime.now(timezone.utc)
        })
    
    # Create notification for consumer
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:8]}",
        "user_id": user.user_id,
        "type": "invite_sent",
        "title": "Invite Sent",
        "message": f"Your invite to {data.tutor_name or data.tutor_email} has been sent with a free session credit offer!",
        "data": {"invite_id": invite_id},
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })
    
    return {
        "success": True,
        "invite_id": invite_id,
        "message": "Invite sent with one free session credit!",
        "credit_amount": 50.00
    }

@api_router.get("/consumer/invites")
async def get_consumer_sent_invites(request: Request):
    """Get invites sent by the consumer to providers"""
    user = await require_auth(request)
    
    invites = await db.consumer_invites.find(
        {"consumer_id": user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"invites": invites}

# ============== REMINDER CONFIGURATION ==============

class ReminderConfig(BaseModel):
    session_reminder_hours: int = 1  # Hours before session
    payment_reminder_days: int = 1  # Days before payment due
    weekly_summary: bool = True

@api_router.get("/reminders/config")
async def get_reminder_config(request: Request):
    """Get user's reminder configuration"""
    user = await require_auth(request)
    
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    config = user_doc.get("reminder_config", {
        "session_reminder_hours": 1,
        "payment_reminder_days": 1,
        "weekly_summary": True
    })
    
    return config

@api_router.put("/reminders/config")
async def update_reminder_config(data: ReminderConfig, request: Request):
    """Update user's reminder configuration"""
    user = await require_auth(request)
    
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"reminder_config": data.dict()}}
    )
    
    return {"success": True, "config": data.dict()}

@api_router.post("/auth/device")
async def register_device(device: DeviceInfo, request: Request):
    user = await require_auth(request)
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    devices = user_doc.get("devices", [])
    device_exists = any(d.get("device_id") == device.device_id for d in devices)
    if not device_exists:
        devices.append(device.dict())
        await db.users.update_one({"user_id": user.user_id}, {"$set": {"devices": devices}})
    return {"message": "Device registered"}

# ============== STUDENT ROUTES ==============

@api_router.get("/students", response_model=List[Student])
async def get_students(request: Request):
    user = await require_auth(request)
    students = await db.students.find({"user_id": user.user_id}, {"_id": 0}).to_list(100)
    return [Student(**s) for s in students]

@api_router.post("/students", response_model=Student)
async def create_student(data: StudentCreate, request: Request):
    user = await require_auth(request)
    student_id = f"student_{uuid.uuid4().hex[:12]}"
    student_doc = {
        "student_id": student_id,
        "user_id": user.user_id,
        **data.dict(),
        "created_at": datetime.now(timezone.utc)
    }
    await db.students.insert_one(student_doc)
    return Student(**student_doc)

@api_router.put("/students/{student_id}", response_model=Student)
async def update_student(student_id: str, data: StudentCreate, request: Request):
    user = await require_auth(request)
    result = await db.students.update_one(
        {"student_id": student_id, "user_id": user.user_id},
        {"$set": data.dict()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
    student = await db.students.find_one({"student_id": student_id}, {"_id": 0})
    return Student(**student)

@api_router.delete("/students/{student_id}")
async def delete_student(student_id: str, request: Request):
    user = await require_auth(request)
    result = await db.students.delete_one({"student_id": student_id, "user_id": user.user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
    return {"message": "Student deleted"}

@api_router.get("/students/{student_id}/schedule")
async def get_student_schedule(student_id: str, request: Request):
    """Get schedule/bookings for a specific kid"""
    user = await require_auth(request)
    
    # Verify student belongs to user
    student = await db.students.find_one({"student_id": student_id, "user_id": user.user_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Get bookings for this student
    bookings = await db.bookings.find({
        "student_id": student_id,
        "status": {"$in": ["confirmed", "pending", "completed"]}
    }, {"_id": 0}).sort("start_at", -1).to_list(100)
    
    # Enrich with tutor info
    enriched = []
    for booking in bookings:
        tutor = await db.tutors.find_one({"tutor_id": booking.get("tutor_id")}, {"_id": 0})
        tutor_user = await db.users.find_one({"user_id": booking.get("tutor_user_id")}, {"_id": 0})
        enriched.append({
            **booking,
            "tutor_name": tutor_user.get("name") if tutor_user else "Unknown",
            "subject": tutor.get("subjects", [])[0] if tutor and tutor.get("subjects") else "General"
        })
    
    return {"student": student, "bookings": enriched}

@api_router.get("/students/{student_id}/payments")
async def get_student_payments(student_id: str, request: Request):
    """Get payment history for a specific kid"""
    user = await require_auth(request)
    
    # Verify student belongs to user
    student = await db.students.find_one({"student_id": student_id, "user_id": user.user_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Get payments for bookings associated with this student
    bookings = await db.bookings.find({"student_id": student_id}, {"_id": 0, "booking_id": 1}).to_list(1000)
    booking_ids = [b["booking_id"] for b in bookings]
    
    payments = await db.payments.find({
        "booking_id": {"$in": booking_ids}
    }, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Calculate totals
    total_paid = sum(p.get("amount", 0) for p in payments if p.get("status") == "completed")
    pending = sum(p.get("amount", 0) for p in payments if p.get("status") == "pending")
    
    return {
        "student": student,
        "payments": payments,
        "total_paid": total_paid,
        "pending_amount": pending
    }

class SendScheduleEmail(BaseModel):
    student_id: str
    quarter: Optional[str] = None  # Q1, Q2, Q3, Q4 or None for current

@api_router.post("/students/{student_id}/send-schedule")
async def send_student_schedule_email(student_id: str, request: Request):
    """Send schedule email to the kid's email address"""
    user = await require_auth(request)
    
    # Verify student belongs to user and has email
    student = await db.students.find_one({"student_id": student_id, "user_id": user.user_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    if not student.get("email"):
        raise HTTPException(status_code=400, detail="Student does not have an email address configured")
    
    # Get upcoming bookings
    now = datetime.now(timezone.utc)
    bookings = await db.bookings.find({
        "student_id": student_id,
        "start_at": {"$gte": now},
        "status": {"$in": ["confirmed", "pending"]}
    }, {"_id": 0}).sort("start_at", 1).to_list(50)
    
    # Build schedule HTML (mock for now - would use Resend in production)
    schedule_html = f"<h2>Schedule for {student.get('name')}</h2>"
    schedule_html += "<table border='1'><tr><th>Date</th><th>Time</th><th>Subject</th></tr>"
    
    for booking in bookings:
        start = booking.get("start_at")
        if isinstance(start, datetime):
            date_str = start.strftime("%B %d, %Y")
            time_str = start.strftime("%I:%M %p")
        else:
            date_str = str(start)
            time_str = ""
        schedule_html += f"<tr><td>{date_str}</td><td>{time_str}</td><td>{booking.get('subject', 'Session')}</td></tr>"
    
    schedule_html += "</table>"
    
    # In production, send via Resend
    # For now, log and return success
    logger.info(f"Would send schedule email to {student.get('email')} with {len(bookings)} upcoming sessions")
    
    # Create notification
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:8]}",
        "user_id": user.user_id,
        "type": "schedule_sent",
        "title": "Schedule Sent",
        "message": f"Schedule email sent to {student.get('name')} ({student.get('email')})",
        "data": {"student_id": student_id, "bookings_count": len(bookings)},
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })
    
    return {
        "success": True,
        "message": f"Schedule email sent to {student.get('email')}",
        "bookings_count": len(bookings)
    }

# ============== TUTOR SCHEDULE ROUTES ==============

class WeeklyScheduleItem(BaseModel):
    day: int  # 0-6 (Sun-Sat)
    enabled: bool
    startTime: str
    endTime: str

class ScheduleCreate(BaseModel):
    weeklySchedule: List[WeeklyScheduleItem]
    duration: str  # month, quarter, year, custom
    customMonths: Optional[int] = None
    startDate: str
    endDate: str
    autoRenew: bool
    reminderDays: int = 14

@api_router.get("/tutors/schedule")
async def get_tutor_schedule(request: Request):
    """Get tutor's schedule configuration"""
    user = await require_auth(request)
    
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")
    
    schedule = await db.tutor_schedules.find_one({"tutor_id": tutor["tutor_id"]}, {"_id": 0})
    if not schedule:
        raise HTTPException(status_code=404, detail="No schedule found")
    
    return schedule

@api_router.post("/tutors/schedule")
async def save_tutor_schedule(data: ScheduleCreate, request: Request):
    """Save tutor's recurring schedule"""
    user = await require_auth(request)
    
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")
    
    schedule_doc = {
        "tutor_id": tutor["tutor_id"],
        "weeklySchedule": [s.dict() for s in data.weeklySchedule],
        "duration": data.duration,
        "customMonths": data.customMonths,
        "startDate": data.startDate,
        "endDate": data.endDate,
        "autoRenew": data.autoRenew,
        "reminderDays": data.reminderDays,
        "updated_at": datetime.now(timezone.utc)
    }
    
    # Upsert the schedule
    await db.tutor_schedules.update_one(
        {"tutor_id": tutor["tutor_id"]},
        {"$set": schedule_doc},
        upsert=True
    )
    
    # Generate availability slots from the weekly schedule
    await generate_availability_from_schedule(tutor["tutor_id"], data)
    
    # If auto-renew is enabled, create a reminder notification
    if data.autoRenew:
        reminder_date = datetime.strptime(data.endDate, "%Y-%m-%d") - timedelta(days=data.reminderDays)
        await db.scheduled_notifications.insert_one({
            "notification_id": f"notif_{uuid.uuid4().hex[:8]}",
            "user_id": user.user_id,
            "type": "schedule_renewal",
            "title": "Schedule Auto-Renewal Reminder",
            "message": f"Your schedule will auto-renew on {data.endDate}",
            "scheduled_for": reminder_date,
            "created_at": datetime.now(timezone.utc)
        })
    
    return {"success": True, "message": "Schedule saved successfully"}

async def generate_availability_from_schedule(tutor_id: str, schedule: ScheduleCreate):
    """Generate availability slots from weekly schedule"""
    from datetime import date as date_type
    
    start = datetime.strptime(schedule.startDate, "%Y-%m-%d")
    end = datetime.strptime(schedule.endDate, "%Y-%m-%d")
    
    # Remove existing weekly rules for this tutor
    await db.availability.delete_many({
        "tutor_id": tutor_id,
        "type": "weekly",
        "source": "schedule_builder"
    })
    
    # Create weekly rules for each enabled day
    for day_schedule in schedule.weeklySchedule:
        if not day_schedule.enabled:
            continue
        
        # Parse times
        start_hour, start_min = map(int, day_schedule.startTime.split(':'))
        end_hour, end_min = map(int, day_schedule.endTime.split(':'))
        
        # Create 1-hour slots for each hour in the range
        current_hour = start_hour
        while current_hour < end_hour:
            slot_start = f"{current_hour:02d}:00"
            slot_end = f"{current_hour + 1:02d}:00"
            
            await db.availability.insert_one({
                "availability_id": f"avail_{uuid.uuid4().hex[:8]}",
                "tutor_id": tutor_id,
                "type": "weekly",
                "source": "schedule_builder",
                "day_of_week": day_schedule.day,
                "start_time": slot_start,
                "end_time": slot_end,
                "valid_from": start,
                "valid_until": end,
                "auto_renew": schedule.autoRenew,
                "created_at": datetime.now(timezone.utc)
            })
            
            current_hour += 1

# ============== TUTOR PROFILE ROUTES ==============

@api_router.post("/tutors/profile", response_model=TutorProfile)
async def create_tutor_profile(data: TutorProfileCreate, request: Request):
    user = await require_auth(request)
    
    # Check if profile exists
    existing = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Tutor profile already exists")
    
    # Determine market_id from payout_country
    payout_country = data.payout_country if hasattr(data, 'payout_country') else 'US'
    market_id = f"{payout_country}_USD" if payout_country == 'US' else f"{payout_country}_INR"
    
    tutor_id = f"tutor_{uuid.uuid4().hex[:12]}"
    tutor_doc = {
        "tutor_id": tutor_id,
        "user_id": user.user_id,
        **data.dict(),
        "market_id": market_id,
        "status": "pending",
        "is_published": False,
        "trial_start_at": None,
        "rating_avg": 0.0,
        "rating_count": 0,
        "created_at": datetime.now(timezone.utc)
    }
    await db.tutors.insert_one(tutor_doc)
    
    # Update user role
    await db.users.update_one({"user_id": user.user_id}, {"$set": {"role": "tutor"}})
    
    return TutorProfile(**tutor_doc)

@api_router.get("/tutors/profile")
async def get_my_tutor_profile(request: Request):
    user = await require_auth(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")
    return TutorProfile(**tutor)

@api_router.put("/tutors/profile", response_model=TutorProfile)
async def update_tutor_profile(data: TutorProfileCreate, request: Request):
    user = await require_auth(request)
    result = await db.tutors.update_one(
        {"user_id": user.user_id},
        {"$set": data.dict()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tutor profile not found")
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    return TutorProfile(**tutor)

@api_router.post("/tutors/publish")
async def publish_tutor_profile(request: Request):
    user = await require_auth(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")
    if tutor["status"] == "suspended":
        raise HTTPException(status_code=400, detail="Profile is suspended")
    await db.tutors.update_one({"user_id": user.user_id}, {"$set": {"is_published": True}})
    return {"message": "Profile published"}

@api_router.post("/tutors/unpublish")
async def unpublish_tutor_profile(request: Request):
    user = await require_auth(request)
    await db.tutors.update_one({"user_id": user.user_id}, {"$set": {"is_published": False}})
    return {"message": "Profile unpublished"}

# ============== SEARCH/DISCOVERY ROUTES ==============

@api_router.get("/tutors/search")
async def search_tutors(
    request: Request,
    query: Optional[str] = None,  # Text search for name, category, subject
    category: Optional[str] = None,
    subject: Optional[str] = None,
    level: Optional[str] = None,
    modality: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort_by: str = "rating",  # rating, price, soonest
    page: int = 1,
    limit: int = 20
):
    db_query = {"is_published": True, "status": "approved"}
    
    # Get consumer's market for filtering and exclude self from results
    current_user_id = None
    try:
        user = await require_auth(request)
        current_user_id = user.user_id
        user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
        consumer_market_id = user_doc.get("market_id") if user_doc else None
        
        # Enforce market filtering if market is set
        if consumer_market_id:
            db_query["market_id"] = consumer_market_id
        
        # Prevent self-selection: exclude current user's tutor profile from results
        # This handles the case where a parent has also become a tutor
        db_query["user_id"] = {"$ne": current_user_id}
    except:
        # Allow unauthenticated browsing without market filter
        pass
    
    # Text search - search in categories and subjects
    if query:
        # Search in categories and subjects arrays with case-insensitive regex
        db_query["$or"] = [
            {"categories": {"$regex": query, "$options": "i"}},
            {"subjects": {"$regex": query, "$options": "i"}},
            {"bio": {"$regex": query, "$options": "i"}}
        ]
    
    if category:
        db_query["categories"] = category
    if subject:
        db_query["subjects"] = {"$regex": subject, "$options": "i"}
    if level:
        db_query["levels"] = level
    if modality:
        db_query["modality"] = modality
    if min_price is not None:
        db_query["base_price"] = {"$gte": min_price}
    if max_price is not None:
        if "base_price" in db_query:
            db_query["base_price"]["$lte"] = max_price
        else:
            db_query["base_price"] = {"$lte": max_price}
    
    sort_field = "rating_avg" if sort_by == "rating" else "base_price" if sort_by == "price" else "created_at"
    sort_order = -1 if sort_by == "rating" else 1
    
    skip = (page - 1) * limit
    tutors = await db.tutors.find(db_query, {"_id": 0}).sort(sort_field, sort_order).skip(skip).limit(limit).to_list(limit)
    
    # Get user info for each tutor and also search by name if query provided
    results = []
    for tutor in tutors:
        user = await db.users.find_one({"user_id": tutor["user_id"]}, {"_id": 0})
        if user:
            # Include market info in results
            market_info = MARKETS_CONFIG.get(tutor.get("market_id"), {})
            results.append({
                **tutor,
                "user_name": user["name"],
                "user_picture": user.get("picture"),
                "currency": market_info.get("currency", "USD"),
                "currency_symbol": market_info.get("currency_symbol", "$")
            })
    
    # If query provided, also search for tutors by user name
    if query and len(results) < limit:
        # Search users by name
        user_matches = await db.users.find(
            {"name": {"$regex": query, "$options": "i"}, "role": "tutor"},
            {"_id": 0, "user_id": 1, "name": 1, "picture": 1}
        ).to_list(limit)
        
        existing_user_ids = {r["user_id"] for r in results}
        for user_match in user_matches:
            if user_match["user_id"] not in existing_user_ids:
                tutor = await db.tutors.find_one({
                    "user_id": user_match["user_id"],
                    "is_published": True,
                    "status": "approved"
                }, {"_id": 0})
                if tutor and (not current_user_id or tutor["user_id"] != current_user_id):
                    market_info = MARKETS_CONFIG.get(tutor.get("market_id"), {})
                    results.append({
                        **tutor,
                        "user_name": user_match["name"],
                        "user_picture": user_match.get("picture"),
                        "currency": market_info.get("currency", "USD"),
                        "currency_symbol": market_info.get("currency_symbol", "$")
                    })
    
    total = await db.tutors.count_documents(db_query)
    
    return {"tutors": results[:limit], "total": total, "page": page, "limit": limit}

@api_router.get("/tutors/{tutor_id}")
async def get_tutor(tutor_id: str, request: Request = None):
    tutor = await db.tutors.find_one({"tutor_id": tutor_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor not found")
    
    # Check if consumer is accessing a tutor from a different market
    if request:
        try:
            user = await require_auth(request)
            user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
            consumer_market_id = user_doc.get("market_id") if user_doc else None
            tutor_market_id = tutor.get("market_id")
            
            if consumer_market_id and tutor_market_id and consumer_market_id != tutor_market_id:
                # Return tutor info with cross-market warning
                market_info = MARKETS_CONFIG.get(tutor_market_id, {})
                user_info = await db.users.find_one({"user_id": tutor["user_id"]}, {"_id": 0})
                return {
                    **tutor,
                    "user_name": user_info["name"] if user_info else "Unknown",
                    "user_picture": user_info.get("picture") if user_info else None,
                    "currency": market_info.get("currency", "USD"),
                    "currency_symbol": market_info.get("currency_symbol", "$"),
                    "cross_market_warning": True,
                    "message": "This tutor is not available in your region. Switch markets to book."
                }
        except:
            pass
    
    user = await db.users.find_one({"user_id": tutor["user_id"]}, {"_id": 0})
    market_info = MARKETS_CONFIG.get(tutor.get("market_id"), {})
    
    return {
        **tutor,
        "user_name": user["name"] if user else "Unknown",
        "user_picture": user.get("picture") if user else None,
        "currency": market_info.get("currency", "USD"),
        "currency_symbol": market_info.get("currency_symbol", "$")
    }

# ============== AVAILABILITY ROUTES ==============

@api_router.get("/availability/rules")
async def get_availability_rules(request: Request):
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")
    
    rules = await db.availability_rules.find({"tutor_id": tutor["tutor_id"]}, {"_id": 0}).to_list(100)
    return rules

@api_router.post("/availability/rules")
async def create_availability_rule(rule: AvailabilityRule, request: Request):
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")
    
    rule_doc = rule.dict()
    rule_doc["tutor_id"] = tutor["tutor_id"]
    rule_doc["rule_id"] = f"rule_{uuid.uuid4().hex[:12]}"
    await db.availability_rules.insert_one(rule_doc)
    return rule_doc

@api_router.post("/availability/rules/bulk")
async def set_availability_rules(rules: List[AvailabilityRuleCreate], request: Request):
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")
    
    # Delete existing rules
    await db.availability_rules.delete_many({"tutor_id": tutor["tutor_id"]})
    
    # Insert new rules
    for rule in rules:
        rule_doc = rule.dict()
        rule_doc["tutor_id"] = tutor["tutor_id"]
        rule_doc["rule_id"] = f"rule_{uuid.uuid4().hex[:12]}"
        await db.availability_rules.insert_one(rule_doc)
    
    return {"message": f"{len(rules)} rules saved"}

@api_router.delete("/availability/rules/{rule_id}")
async def delete_availability_rule(rule_id: str, request: Request):
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")
    
    result = await db.availability_rules.delete_one({"rule_id": rule_id, "tutor_id": tutor["tutor_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"message": "Rule deleted"}

@api_router.post("/availability/exceptions")
async def create_availability_exception(exc: AvailabilityException, request: Request):
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")
    
    exc_doc = exc.dict()
    exc_doc["tutor_id"] = tutor["tutor_id"]
    exc_doc["exception_id"] = f"exc_{uuid.uuid4().hex[:12]}"
    await db.availability_exceptions.insert_one(exc_doc)
    return exc_doc

@api_router.get("/availability/exceptions")
async def get_availability_exceptions(request: Request):
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")
    
    exceptions = await db.availability_exceptions.find({"tutor_id": tutor["tutor_id"]}, {"_id": 0}).to_list(100)
    return exceptions

# ============== VACATION MANAGEMENT ==============

@api_router.get("/availability/vacations")
async def get_vacations(request: Request):
    """Get tutor's vacation periods"""
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")
    
    vacations = await db.vacations.find({"tutor_id": tutor["tutor_id"]}, {"_id": 0}).to_list(100)
    return vacations

@api_router.post("/availability/vacations")
async def create_vacation(data: VacationPeriodCreate, request: Request):
    """Create a vacation period"""
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")
    
    # Validate dates
    try:
        start = datetime.strptime(data.start_date, "%Y-%m-%d")
        end = datetime.strptime(data.end_date, "%Y-%m-%d")
        if end < start:
            raise HTTPException(status_code=400, detail="End date must be after start date")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    vacation_doc = {
        "vacation_id": f"vac_{uuid.uuid4().hex[:12]}",
        "tutor_id": tutor["tutor_id"],
        "start_date": data.start_date,
        "end_date": data.end_date,
        "reason": data.reason,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.vacations.insert_one(vacation_doc)
    return {**vacation_doc, "_id": None}

@api_router.delete("/availability/vacations/{vacation_id}")
async def delete_vacation(vacation_id: str, request: Request):
    """Delete a vacation period"""
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")
    
    result = await db.vacations.delete_one({
        "vacation_id": vacation_id,
        "tutor_id": tutor["tutor_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vacation not found")
    
    return {"success": True, "message": "Vacation deleted"}

@api_router.get("/tutors/{tutor_id}/availability")
async def get_tutor_availability(tutor_id: str, from_date: str = None, to_date: str = None):
    """Get available time slots for a tutor"""
    tutor = await db.tutors.find_one({"tutor_id": tutor_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor not found")
    
    # Get availability rules
    rules = await db.availability_rules.find({"tutor_id": tutor_id}, {"_id": 0}).to_list(100)
    
    # Get exceptions
    exceptions = await db.availability_exceptions.find({"tutor_id": tutor_id}, {"_id": 0}).to_list(100)
    
    # Get existing bookings
    now = datetime.now(timezone.utc)
    bookings = await db.bookings.find({
        "tutor_id": tutor_id,
        "status": {"$in": ["booked", "confirmed"]},
        "start_at": {"$gte": now}
    }, {"_id": 0}).to_list(1000)
    
    # Get active holds
    holds = await db.booking_holds.find({
        "tutor_id": tutor_id,
        "expires_at": {"$gt": now}
    }, {"_id": 0}).to_list(100)
    
    # Generate available slots for next 30 days
    slots = []
    from_dt = datetime.fromisoformat(from_date) if from_date else now
    to_dt = datetime.fromisoformat(to_date) if to_date else now + timedelta(days=30)
    
    current = from_dt
    while current < to_dt:
        # Convert Python weekday (Monday=0) to JS weekday (Sunday=0)
        python_weekday = current.weekday()
        js_day_of_week = (python_weekday + 1) % 7  # Convert: Mon=0 -> Mon=1, Sun=6 -> Sun=0
        date_str = current.strftime("%Y-%m-%d")
        
        # Check for exceptions on this date
        date_exceptions = [e for e in exceptions if e["date"] == date_str]
        blocked_dates = [e for e in date_exceptions if not e["is_available"]]
        
        if not blocked_dates:
            # Find rules for this day (using JS convention where Sunday=0)
            day_rules = [r for r in rules if r["day_of_week"] == js_day_of_week]
            
            for rule in day_rules:
                start_parts = rule["start_time"].split(":")
                end_parts = rule["end_time"].split(":")
                
                slot_start = current.replace(
                    hour=int(start_parts[0]),
                    minute=int(start_parts[1]),
                    second=0,
                    microsecond=0
                )
                slot_end = current.replace(
                    hour=int(end_parts[0]),
                    minute=int(end_parts[1]),
                    second=0,
                    microsecond=0
                )
                
                # Generate hourly slots
                duration = tutor.get("duration_minutes", 60)
                slot_current = slot_start
                while slot_current + timedelta(minutes=duration) <= slot_end:
                    slot_end_time = slot_current + timedelta(minutes=duration)
                    
                    # Check if slot conflicts with existing bookings
                    is_booked = any(
                        b["start_at"] < slot_end_time and b["end_at"] > slot_current
                        for b in bookings
                    )
                    
                    # Check if slot is on hold
                    is_held = any(
                        h["start_at"] < slot_end_time and h["end_at"] > slot_current
                        for h in holds
                    )
                    
                    if not is_booked and not is_held and slot_current > now:
                        slots.append({
                            "start_at": slot_current.isoformat(),
                            "end_at": slot_end_time.isoformat(),
                            "available": True
                        })
                    
                    slot_current = slot_end_time
        
        current += timedelta(days=1)
    
    return {"tutor_id": tutor_id, "slots": slots[:100]}  # Limit to 100 slots

# ============== BOOKING ROUTES ==============

@api_router.post("/booking-holds", response_model=BookingHold)
async def create_booking_hold(data: BookingHoldCreate, request: Request):
    user = await require_auth(request)
    
    # Check tutor exists
    tutor = await db.tutors.find_one({"tutor_id": data.tutor_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor not found")
    
    start_at = data.start_at
    if start_at.tzinfo is None:
        start_at = start_at.replace(tzinfo=timezone.utc)
    end_at = start_at + timedelta(minutes=data.duration_minutes)
    
    # Check for conflicts
    existing_booking = await db.bookings.find_one({
        "tutor_id": data.tutor_id,
        "status": {"$in": ["booked", "confirmed"]},
        "start_at": {"$lt": end_at},
        "end_at": {"$gt": start_at}
    })
    if existing_booking:
        raise HTTPException(status_code=409, detail="Slot already booked")
    
    # Check for existing holds
    existing_hold = await db.booking_holds.find_one({
        "tutor_id": data.tutor_id,
        "expires_at": {"$gt": datetime.now(timezone.utc)},
        "start_at": {"$lt": end_at},
        "end_at": {"$gt": start_at}
    })
    if existing_hold:
        raise HTTPException(status_code=409, detail="Slot is on hold")
    
    hold_id = f"hold_{uuid.uuid4().hex[:12]}"
    hold_doc = {
        "hold_id": hold_id,
        "tutor_id": data.tutor_id,
        "consumer_id": user.user_id,
        "start_at": start_at,
        "end_at": end_at,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
        "created_at": datetime.now(timezone.utc)
    }
    await db.booking_holds.insert_one(hold_doc)
    
    return BookingHold(**hold_doc)

@api_router.post("/bookings")
async def create_booking(data: BookingCreate, request: Request):
    user = await require_auth(request)
    
    # Get hold
    hold = await db.booking_holds.find_one({"hold_id": data.hold_id}, {"_id": 0})
    if not hold:
        raise HTTPException(status_code=404, detail="Hold not found")
    
    # Check hold hasn't expired
    expires_at = hold["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Hold has expired")
    
    # Check hold belongs to user
    if hold["consumer_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Hold does not belong to you")
    
    # Get tutor and student
    tutor = await db.tutors.find_one({"tutor_id": hold["tutor_id"]}, {"_id": 0})
    student = await db.students.find_one({"student_id": data.student_id}, {"_id": 0})
    
    if not student or student["user_id"] != user.user_id:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Get consumer's market
    consumer_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    consumer_market_id = consumer_doc.get("market_id")
    tutor_market_id = tutor.get("market_id")
    
    # Enforce same-market booking (if feature flag is on)
    if FEATURE_FLAGS["IN_MARKET_ONLY_BOOKING_ENFORCED"]:
        if consumer_market_id and tutor_market_id and consumer_market_id != tutor_market_id:
            raise HTTPException(
                status_code=400, 
                detail=f"Cross-market booking not allowed. Consumer market: {consumer_market_id}, Tutor market: {tutor_market_id}"
            )
    
    # Determine market and currency for booking
    booking_market_id = tutor_market_id or consumer_market_id or "US_USD"
    market_config = MARKETS_CONFIG.get(booking_market_id, MARKETS_CONFIG["US_USD"])
    
    # Get pricing policy snapshot
    pricing_policy = await db.pricing_policies.find_one({"market_id": booking_market_id}, {"_id": 0})
    if not pricing_policy:
        pricing_policy = {
            "market_id": booking_market_id,
            "trial_days": 90,
            "provider_fee_percent": 0.0,
            "consumer_fee_percent": 0.0
        }
    
    # Calculate amount in cents
    amount_cents = int(tutor["base_price"] * 100)
    
    booking_id = f"booking_{uuid.uuid4().hex[:12]}"
    booking_doc = {
        "booking_id": booking_id,
        "tutor_id": hold["tutor_id"],
        "consumer_id": user.user_id,
        "student_id": data.student_id,
        "market_id": booking_market_id,
        "currency": market_config["currency"],
        "start_at": hold["start_at"],
        "end_at": hold["end_at"],
        "status": "booked",
        "price_snapshot": tutor["base_price"],
        "amount_cents": amount_cents,
        "policy_snapshot": tutor.get("policies", {}),
        "pricing_policy_snapshot": pricing_policy,
        "intake_response": data.intake.dict(),
        "payment_id": f"pay_{uuid.uuid4().hex[:12]}",  # Placeholder
        "created_at": datetime.now(timezone.utc)
    }
    await db.bookings.insert_one(booking_doc)
    
    # Delete hold
    await db.booking_holds.delete_one({"hold_id": data.hold_id})
    
    # Start trial if first booking
    if not tutor.get("trial_start_at"):
        await db.tutors.update_one(
            {"tutor_id": hold["tutor_id"]},
            {"$set": {"trial_start_at": datetime.now(timezone.utc)}}
        )
    
    # TODO: Send confirmation emails via Resend
    # TODO: Process payment via Stripe with market-specific currency
    
    return booking_doc

@api_router.get("/bookings")
async def get_bookings(request: Request, role: str = "consumer"):
    user = await require_auth(request)
    
    if role == "consumer":
        query = {"consumer_id": user.user_id}
    else:
        tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
        if not tutor:
            raise HTTPException(status_code=404, detail="Tutor profile not found")
        query = {"tutor_id": tutor["tutor_id"]}
    
    bookings = await db.bookings.find(query, {"_id": 0}).sort("start_at", -1).to_list(100)
    
    # Enrich with tutor/student info
    results = []
    for b in bookings:
        tutor = await db.tutors.find_one({"tutor_id": b["tutor_id"]}, {"_id": 0})
        tutor_user = await db.users.find_one({"user_id": tutor["user_id"]}, {"_id": 0}) if tutor else None
        student = await db.students.find_one({"student_id": b["student_id"]}, {"_id": 0})
        
        results.append({
            **b,
            "tutor_name": tutor_user["name"] if tutor_user else "Unknown",
            "student_name": student["name"] if student else "Unknown"
        })
    
    return results

@api_router.get("/bookings/{booking_id}")
async def get_booking(booking_id: str, request: Request):
    user = await require_auth(request)
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check access
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if booking["consumer_id"] != user.user_id and (not tutor or tutor["tutor_id"] != booking["tutor_id"]):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return booking

@api_router.post("/bookings/{booking_id}/cancel")
async def cancel_booking(booking_id: str, request: Request):
    user = await require_auth(request)
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["status"] not in ["booked", "confirmed"]:
        raise HTTPException(status_code=400, detail="Cannot cancel this booking")
    
    # Determine cancellation type
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if booking["consumer_id"] == user.user_id:
        new_status = "canceled_by_consumer"
    elif tutor and tutor["tutor_id"] == booking["tutor_id"]:
        new_status = "canceled_by_provider"
    else:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {"status": new_status, "canceled_at": datetime.now(timezone.utc)}}
    )
    
    # TODO: Process refund via Stripe based on policy
    # TODO: Send cancellation emails
    
    return {"message": "Booking canceled", "status": new_status}

@api_router.post("/bookings/{booking_id}/complete")
async def complete_booking(booking_id: str, request: Request):
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["tutor_id"] != tutor["tutor_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if booking["status"] != "booked" and booking["status"] != "confirmed":
        raise HTTPException(status_code=400, detail="Cannot complete this booking")
    
    await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc)}}
    )
    
    # Generate NSF event if new student
    trial_end = None
    if tutor.get("trial_start_at"):
        trial_start = tutor["trial_start_at"]
        if trial_start.tzinfo is None:
            trial_start = trial_start.replace(tzinfo=timezone.utc)
        trial_end = trial_start + timedelta(days=90)
    
    is_in_trial = trial_end and datetime.now(timezone.utc) < trial_end
    
    # Check if student is new (no completed bookings in last 24 months)
    lookback = datetime.now(timezone.utc) - timedelta(days=24*30)
    previous_booking = await db.bookings.find_one({
        "tutor_id": booking["tutor_id"],
        "student_id": booking["student_id"],
        "status": "completed",
        "booking_id": {"$ne": booking_id},
        "completed_at": {"$gte": lookback}
    })
    
    if not previous_booking:
        # Create NSF event
        event_doc = {
            "event_id": f"fee_{uuid.uuid4().hex[:12]}",
            "tutor_id": booking["tutor_id"],
            "event_type": "NSF",
            "booking_id": booking_id,
            "student_id": booking["student_id"],
            "amount_cents": 0,  # Configurable
            "currency": "USD",
            "status": "WAIVED" if is_in_trial else "PENDING",
            "reason": "Trial period" if is_in_trial else None,
            "created_at": datetime.now(timezone.utc)
        }
        await db.provider_fee_events.insert_one(event_doc)
    
    return {"message": "Booking completed"}

# ============== REVIEW ROUTES ==============

@api_router.post("/bookings/{booking_id}/review")
async def create_review(booking_id: str, data: ReviewCreate, request: Request):
    user = await require_auth(request)
    
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["consumer_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if booking["status"] != "completed":
        raise HTTPException(status_code=400, detail="Can only review completed bookings")
    
    # Check if already reviewed
    existing = await db.reviews.find_one({"booking_id": booking_id})
    if existing:
        raise HTTPException(status_code=400, detail="Already reviewed")
    
    student = await db.students.find_one({"student_id": booking["student_id"]}, {"_id": 0})
    
    review_doc = {
        "review_id": f"review_{uuid.uuid4().hex[:12]}",
        "booking_id": booking_id,
        "tutor_id": booking["tutor_id"],
        "consumer_id": user.user_id,
        "student_name": student["name"] if student else "Unknown",
        **data.dict(),
        "created_at": datetime.now(timezone.utc)
    }
    await db.reviews.insert_one(review_doc)
    
    # Update tutor rating
    reviews = await db.reviews.find({"tutor_id": booking["tutor_id"]}, {"_id": 0}).to_list(1000)
    avg_rating = sum(r["rating"] for r in reviews) / len(reviews)
    await db.tutors.update_one(
        {"tutor_id": booking["tutor_id"]},
        {"$set": {"rating_avg": round(avg_rating, 2), "rating_count": len(reviews)}}
    )
    
    return review_doc

@api_router.get("/tutors/{tutor_id}/reviews")
async def get_tutor_reviews(tutor_id: str, page: int = 1, limit: int = 20):
    skip = (page - 1) * limit
    reviews = await db.reviews.find({"tutor_id": tutor_id}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.reviews.count_documents({"tutor_id": tutor_id})
    return {"reviews": reviews, "total": total, "page": page}

# ============== ADMIN ROUTES ==============

@api_router.get("/admin/tutors")
async def admin_get_tutors(request: Request, status: Optional[str] = None):
    await require_admin(request)
    
    query = {}
    if status:
        query["status"] = status
    
    tutors = await db.tutors.find(query, {"_id": 0}).to_list(100)
    
    results = []
    for t in tutors:
        user = await db.users.find_one({"user_id": t["user_id"]}, {"_id": 0})
        results.append({
            **t,
            "user_name": user["name"] if user else "Unknown",
            "user_email": user["email"] if user else "Unknown"
        })
    
    return results

@api_router.post("/admin/tutors/{tutor_id}/approve")
async def admin_approve_tutor(tutor_id: str, request: Request):
    user = await require_admin(request)
    
    # Approve AND auto-publish the tutor
    result = await db.tutors.update_one(
        {"tutor_id": tutor_id},
        {"$set": {"status": "approved", "is_published": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tutor not found")
    
    # Log action
    await db.audit_logs.insert_one({
        "action": "approve_tutor",
        "target_id": tutor_id,
        "actor_id": user.user_id,
        "created_at": datetime.now(timezone.utc)
    })
    
    return {"message": "Tutor approved and published"}

@api_router.post("/admin/tutors/{tutor_id}/suspend")
async def admin_suspend_tutor(tutor_id: str, reason: str = "", request: Request = None):
    user = await require_admin(request)
    
    result = await db.tutors.update_one(
        {"tutor_id": tutor_id},
        {"$set": {"status": "suspended", "is_published": False}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tutor not found")
    
    await db.audit_logs.insert_one({
        "action": "suspend_tutor",
        "target_id": tutor_id,
        "actor_id": user.user_id,
        "reason": reason,
        "created_at": datetime.now(timezone.utc)
    })
    
    return {"message": "Tutor suspended"}

@api_router.post("/admin/bookings/{booking_id}/refund")
async def admin_refund_booking(booking_id: str, amount: Optional[float] = None, request: Request = None):
    user = await require_admin(request)
    
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    refund_amount = amount if amount else booking["price_snapshot"]
    
    # TODO: Process refund via Stripe
    
    await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {"refund_amount": refund_amount, "refunded_at": datetime.now(timezone.utc)}}
    )
    
    await db.audit_logs.insert_one({
        "action": "refund_booking",
        "target_id": booking_id,
        "actor_id": user.user_id,
        "amount": refund_amount,
        "created_at": datetime.now(timezone.utc)
    })
    
    return {"message": f"Refund of ${refund_amount} processed"}

# ============== BILLING ROUTES ==============

@api_router.get("/billing/summary")
async def get_billing_summary(request: Request):
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")
    
    # Calculate trial status
    trial_status = "not_started"
    trial_days_remaining = 0
    
    if tutor.get("trial_start_at"):
        trial_start = tutor["trial_start_at"]
        if trial_start.tzinfo is None:
            trial_start = trial_start.replace(tzinfo=timezone.utc)
        trial_end = trial_start + timedelta(days=90)
        
        if datetime.now(timezone.utc) < trial_end:
            trial_status = "active"
            trial_days_remaining = (trial_end - datetime.now(timezone.utc)).days
        else:
            trial_status = "ended"
    
    # Get fee events
    fee_events = await db.provider_fee_events.find(
        {"tutor_id": tutor["tutor_id"]},
        {"_id": 0}
    ).to_list(100)
    
    pending_fees = sum(e["amount_cents"] for e in fee_events if e["status"] == "PENDING")
    
    # Get earnings
    completed_bookings = await db.bookings.find(
        {"tutor_id": tutor["tutor_id"], "status": "completed"},
        {"_id": 0}
    ).to_list(1000)
    
    total_earnings = sum(b["price_snapshot"] for b in completed_bookings)
    
    return {
        "trial_status": trial_status,
        "trial_days_remaining": trial_days_remaining,
        "pending_fees_cents": pending_fees,
        "total_earnings": total_earnings,
        "completed_lessons": len(completed_bookings),
        "fee_events": fee_events[-10:]  # Last 10 events
    }

@api_router.get("/billing/fee-events")
async def get_fee_events(request: Request):
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")
    
    events = await db.provider_fee_events.find(
        {"tutor_id": tutor["tutor_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return events

# ============== STRIPE PAYMENT ROUTES ==============

class CreateCheckoutRequest(BaseModel):
    booking_id: str
    success_url: str
    cancel_url: str

class PaymentIntentRequest(BaseModel):
    hold_id: str
    student_id: str

@api_router.post("/payments/create-intent")
async def create_payment_intent(data: PaymentIntentRequest, request: Request):
    """Create a Stripe PaymentIntent for a booking hold"""
    user = await require_auth(request)
    
    # Get hold
    hold = await db.booking_holds.find_one({"hold_id": data.hold_id}, {"_id": 0})
    if not hold:
        raise HTTPException(status_code=404, detail="Hold not found")
    
    if hold["consumer_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Hold does not belong to you")
    
    # Get tutor
    tutor = await db.tutors.find_one({"tutor_id": hold["tutor_id"]}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor not found")
    
    # Get market config
    market_id = tutor.get("market_id", "US_USD")
    market_config = MARKETS_CONFIG.get(market_id, MARKETS_CONFIG["US_USD"])
    
    amount_cents = int(tutor["base_price"] * 100)
    currency = market_config["currency"].lower()
    
    # Calculate platform fee and tutor payout
    platform_fee_cents = int(amount_cents * PLATFORM_FEE_PERCENT / 100)
    tutor_payout_cents = amount_cents - platform_fee_cents
    
    # In production, create real Stripe PaymentIntent
    # For now, create a mock payment intent
    payment_intent_id = f"pi_{uuid.uuid4().hex[:24]}"
    client_secret = f"{payment_intent_id}_secret_{uuid.uuid4().hex[:24]}"
    
    # Store payment intent in database
    payment_doc = {
        "payment_intent_id": payment_intent_id,
        "hold_id": data.hold_id,
        "student_id": data.student_id,
        "consumer_id": user.user_id,
        "tutor_id": hold["tutor_id"],
        "amount_cents": amount_cents,
        "platform_fee_cents": platform_fee_cents,
        "tutor_payout_cents": tutor_payout_cents,
        "currency": currency,
        "market_id": market_id,
        "status": "requires_payment_method",
        "created_at": datetime.now(timezone.utc)
    }
    await db.payment_intents.insert_one(payment_doc)
    
    return {
        "payment_intent_id": payment_intent_id,
        "client_secret": client_secret,
        "amount_cents": amount_cents,
        "currency": currency,
        "currency_symbol": market_config["currency_symbol"],
        "platform_fee_cents": platform_fee_cents,
        "publishable_key": STRIPE_PUBLISHABLE_KEY
    }

@api_router.post("/payments/confirm")
async def confirm_payment(request: Request):
    """Confirm payment and create booking (mock for placeholder keys)"""
    user = await require_auth(request)
    body = await request.json()
    
    payment_intent_id = body.get("payment_intent_id")
    if not payment_intent_id:
        raise HTTPException(status_code=400, detail="Payment intent ID required")
    
    # Get payment intent
    payment = await db.payment_intents.find_one({"payment_intent_id": payment_intent_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment intent not found")
    
    if payment["consumer_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Payment does not belong to you")
    
    if payment["status"] == "succeeded":
        raise HTTPException(status_code=400, detail="Payment already processed")
    
    # Get hold
    hold = await db.booking_holds.find_one({"hold_id": payment["hold_id"]}, {"_id": 0})
    if not hold:
        raise HTTPException(status_code=404, detail="Hold not found or expired")
    
    # Get tutor
    tutor = await db.tutors.find_one({"tutor_id": payment["tutor_id"]}, {"_id": 0})
    tutor_user = await db.users.find_one({"user_id": tutor["user_id"]}, {"_id": 0})
    
    # Update payment status
    await db.payment_intents.update_one(
        {"payment_intent_id": payment_intent_id},
        {"$set": {"status": "succeeded", "paid_at": datetime.now(timezone.utc)}}
    )
    
    # Create booking
    booking_id = f"booking_{uuid.uuid4().hex[:12]}"
    market_config = MARKETS_CONFIG.get(payment["market_id"], MARKETS_CONFIG["US_USD"])
    
    # Get pricing policy
    pricing_policy = await db.pricing_policies.find_one({"market_id": payment["market_id"]}, {"_id": 0})
    if not pricing_policy:
        pricing_policy = {"market_id": payment["market_id"], "provider_fee_percent": PLATFORM_FEE_PERCENT}
    
    booking_doc = {
        "booking_id": booking_id,
        "tutor_id": payment["tutor_id"],
        "consumer_id": user.user_id,
        "student_id": payment["student_id"],
        "market_id": payment["market_id"],
        "currency": payment["currency"].upper(),
        "start_at": hold["start_at"],
        "end_at": hold["end_at"],
        "status": "booked",
        "payment_status": "paid",
        "price_snapshot": payment["amount_cents"] / 100,
        "amount_cents": payment["amount_cents"],
        "platform_fee_cents": payment["platform_fee_cents"],
        "tutor_payout_cents": payment["tutor_payout_cents"],
        "policy_snapshot": tutor.get("policies", {}),
        "pricing_policy_snapshot": pricing_policy,
        "payment_intent_id": payment_intent_id,
        "created_at": datetime.now(timezone.utc)
    }
    await db.bookings.insert_one(booking_doc)
    
    # Delete hold
    await db.booking_holds.delete_one({"hold_id": payment["hold_id"]})
    
    # Process immediate payout to tutor
    payout_id = f"payout_{uuid.uuid4().hex[:12]}"
    payout_doc = {
        "payout_id": payout_id,
        "booking_id": booking_id,
        "tutor_id": payment["tutor_id"],
        "amount_cents": payment["tutor_payout_cents"],
        "platform_fee_cents": payment["platform_fee_cents"],
        "currency": payment["currency"],
        "market_id": payment["market_id"],
        "status": "completed",  # In production, this would be "pending" until Stripe transfer completes
        "stripe_transfer_id": f"tr_{uuid.uuid4().hex[:24]}",  # Mock transfer ID
        "created_at": datetime.now(timezone.utc),
        "completed_at": datetime.now(timezone.utc)
    }
    await db.payouts.insert_one(payout_doc)
    
    # Start trial if first booking
    if not tutor.get("trial_start_at"):
        await db.tutors.update_one(
            {"tutor_id": payment["tutor_id"]},
            {"$set": {"trial_start_at": datetime.now(timezone.utc)}}
        )
    
    return {
        "success": True,
        "booking_id": booking_id,
        "payout_id": payout_id,
        "message": "Payment confirmed and booking created"
    }

@api_router.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    
    # In production, verify webhook signature using STRIPE_WEBHOOK_SECRET
    # For placeholder mode, just parse the JSON
    try:
        event = await request.json()
    except:
        raise HTTPException(status_code=400, detail="Invalid payload")
    
    event_type = event.get("type", "")
    data = event.get("data", {}).get("object", {})
    
    logger.info(f"Stripe webhook received: {event_type}")
    
    if event_type == "payment_intent.succeeded":
        payment_intent_id = data.get("id")
        if payment_intent_id:
            await db.payment_intents.update_one(
                {"payment_intent_id": payment_intent_id},
                {"$set": {"status": "succeeded", "paid_at": datetime.now(timezone.utc)}}
            )
            logger.info(f"Payment succeeded: {payment_intent_id}")
    
    elif event_type == "payment_intent.payment_failed":
        payment_intent_id = data.get("id")
        failure_message = data.get("last_payment_error", {}).get("message", "Unknown error")
        if payment_intent_id:
            await db.payment_intents.update_one(
                {"payment_intent_id": payment_intent_id},
                {"$set": {"status": "failed", "failure_message": failure_message}}
            )
            logger.info(f"Payment failed: {payment_intent_id} - {failure_message}")
    
    elif event_type == "charge.refunded":
        charge_id = data.get("id")
        payment_intent_id = data.get("payment_intent")
        refund_amount = data.get("amount_refunded", 0)
        
        if payment_intent_id:
            # Update payment intent
            await db.payment_intents.update_one(
                {"payment_intent_id": payment_intent_id},
                {"$set": {"status": "refunded", "refunded_at": datetime.now(timezone.utc), "refund_amount_cents": refund_amount}}
            )
            
            # Find and update booking
            booking = await db.bookings.find_one({"payment_intent_id": payment_intent_id})
            if booking:
                await db.bookings.update_one(
                    {"booking_id": booking["booking_id"]},
                    {"$set": {"payment_status": "refunded", "refunded_at": datetime.now(timezone.utc)}}
                )
                
                # Create refund record
                await db.refunds.insert_one({
                    "refund_id": f"refund_{uuid.uuid4().hex[:12]}",
                    "booking_id": booking["booking_id"],
                    "payment_intent_id": payment_intent_id,
                    "amount_cents": refund_amount,
                    "status": "completed",
                    "created_at": datetime.now(timezone.utc)
                })
            
            logger.info(f"Charge refunded: {charge_id}")
    
    elif event_type == "transfer.created":
        transfer_id = data.get("id")
        logger.info(f"Transfer created: {transfer_id}")
    
    elif event_type == "transfer.failed":
        transfer_id = data.get("id")
        # Update payout status
        await db.payouts.update_one(
            {"stripe_transfer_id": transfer_id},
            {"$set": {"status": "failed", "failed_at": datetime.now(timezone.utc)}}
        )
        logger.info(f"Transfer failed: {transfer_id}")
    
    return {"received": True}

# ============== PAYOUT ROUTES ==============

@api_router.get("/payouts")
async def get_payouts(request: Request):
    """Get tutor's payout history"""
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")
    
    payouts = await db.payouts.find(
        {"tutor_id": tutor["tutor_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich with booking info
    results = []
    for payout in payouts:
        booking = await db.bookings.find_one({"booking_id": payout["booking_id"]}, {"_id": 0})
        student = None
        if booking:
            student = await db.students.find_one({"student_id": booking.get("student_id")}, {"_id": 0})
        
        results.append({
            **payout,
            "student_name": student["name"] if student else "Unknown",
            "session_date": booking["start_at"] if booking else None
        })
    
    return results

@api_router.get("/payouts/summary")
async def get_payout_summary(request: Request):
    """Get tutor's payout summary"""
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")
    
    payouts = await db.payouts.find(
        {"tutor_id": tutor["tutor_id"]},
        {"_id": 0}
    ).to_list(1000)
    
    total_earned = sum(p["amount_cents"] for p in payouts if p["status"] == "completed")
    pending = sum(p["amount_cents"] for p in payouts if p["status"] == "pending")
    total_fees = sum(p.get("platform_fee_cents", 0) for p in payouts)
    
    # Get market config for currency
    market_id = tutor.get("market_id", "US_USD")
    market_config = MARKETS_CONFIG.get(market_id, MARKETS_CONFIG["US_USD"])
    
    return {
        "total_earned_cents": total_earned,
        "pending_cents": pending,
        "total_platform_fees_cents": total_fees,
        "total_payouts": len(payouts),
        "currency": market_config["currency"],
        "currency_symbol": market_config["currency_symbol"]
    }

# ============== REPORTS ROUTES ==============

@api_router.get("/reports/consumer")
async def get_consumer_report(
    request: Request,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get consumer's session and cost report"""
    user = await require_auth(request)
    
    # Build query
    query = {"consumer_id": user.user_id}
    
    if start_date:
        query["created_at"] = {"$gte": datetime.fromisoformat(start_date.replace('Z', '+00:00'))}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        else:
            query["created_at"] = {"$lte": datetime.fromisoformat(end_date.replace('Z', '+00:00'))}
    
    bookings = await db.bookings.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Get user's market
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    market_id = user_doc.get("market_id", "US_USD")
    market_config = MARKETS_CONFIG.get(market_id, MARKETS_CONFIG["US_USD"])
    
    # Calculate summaries
    total_sessions = len(bookings)
    completed_sessions = len([b for b in bookings if b["status"] == "completed"])
    upcoming_sessions = len([b for b in bookings if b["status"] in ["booked", "confirmed"]])
    canceled_sessions = len([b for b in bookings if "canceled" in b["status"]])
    
    total_spent_cents = sum(b.get("amount_cents", 0) for b in bookings if b.get("payment_status") == "paid")
    
    # Group by tutor
    by_tutor = {}
    for b in bookings:
        tid = b["tutor_id"]
        if tid not in by_tutor:
            tutor = await db.tutors.find_one({"tutor_id": tid}, {"_id": 0})
            tutor_user = await db.users.find_one({"user_id": tutor["user_id"]}, {"_id": 0}) if tutor else None
            by_tutor[tid] = {
                "tutor_id": tid,
                "tutor_name": tutor_user["name"] if tutor_user else "Unknown",
                "sessions": 0,
                "spent_cents": 0
            }
        by_tutor[tid]["sessions"] += 1
        by_tutor[tid]["spent_cents"] += b.get("amount_cents", 0) if b.get("payment_status") == "paid" else 0
    
    # Group by student
    by_student = {}
    for b in bookings:
        sid = b.get("student_id")
        if sid and sid not in by_student:
            student = await db.students.find_one({"student_id": sid}, {"_id": 0})
            by_student[sid] = {
                "student_id": sid,
                "student_name": student["name"] if student else "Unknown",
                "sessions": 0,
                "spent_cents": 0
            }
        if sid:
            by_student[sid]["sessions"] += 1
            by_student[sid]["spent_cents"] += b.get("amount_cents", 0) if b.get("payment_status") == "paid" else 0
    
    # Group by month
    by_month = {}
    for b in bookings:
        created = b.get("created_at")
        if created:
            if isinstance(created, str):
                created = datetime.fromisoformat(created.replace('Z', '+00:00'))
            month_key = created.strftime("%Y-%m")
            if month_key not in by_month:
                by_month[month_key] = {"month": month_key, "sessions": 0, "spent_cents": 0}
            by_month[month_key]["sessions"] += 1
            by_month[month_key]["spent_cents"] += b.get("amount_cents", 0) if b.get("payment_status") == "paid" else 0
    
    return {
        "summary": {
            "total_sessions": total_sessions,
            "completed_sessions": completed_sessions,
            "upcoming_sessions": upcoming_sessions,
            "canceled_sessions": canceled_sessions,
            "total_spent_cents": total_spent_cents,
            "currency": market_config["currency"],
            "currency_symbol": market_config["currency_symbol"]
        },
        "by_tutor": list(by_tutor.values()),
        "by_student": list(by_student.values()),
        "by_month": sorted(by_month.values(), key=lambda x: x["month"], reverse=True),
        "bookings": bookings[:50]  # Last 50 bookings
    }

@api_router.get("/reports/provider")
async def get_provider_report(
    request: Request,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get tutor's session and earnings report"""
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")
    
    # Build query for bookings
    query = {"tutor_id": tutor["tutor_id"]}
    
    if start_date:
        query["created_at"] = {"$gte": datetime.fromisoformat(start_date.replace('Z', '+00:00'))}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        else:
            query["created_at"] = {"$lte": datetime.fromisoformat(end_date.replace('Z', '+00:00'))}
    
    bookings = await db.bookings.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Get payouts
    payout_query = {"tutor_id": tutor["tutor_id"]}
    payouts = await db.payouts.find(payout_query, {"_id": 0}).to_list(1000)
    
    # Get market config
    market_id = tutor.get("market_id", "US_USD")
    market_config = MARKETS_CONFIG.get(market_id, MARKETS_CONFIG["US_USD"])
    
    # Calculate summaries
    total_sessions = len(bookings)
    completed_sessions = len([b for b in bookings if b["status"] == "completed"])
    upcoming_sessions = len([b for b in bookings if b["status"] in ["booked", "confirmed"]])
    canceled_sessions = len([b for b in bookings if "canceled" in b["status"]])
    
    total_earned_cents = sum(p["amount_cents"] for p in payouts if p["status"] == "completed")
    pending_cents = sum(p["amount_cents"] for p in payouts if p["status"] == "pending")
    total_fees_cents = sum(p.get("platform_fee_cents", 0) for p in payouts)
    
    # Group by student
    by_student = {}
    for b in bookings:
        sid = b.get("student_id")
        if sid and sid not in by_student:
            student = await db.students.find_one({"student_id": sid}, {"_id": 0})
            by_student[sid] = {
                "student_id": sid,
                "student_name": student["name"] if student else "Unknown",
                "sessions": 0,
                "earned_cents": 0
            }
        if sid:
            by_student[sid]["sessions"] += 1
            # Find payout for this booking
            payout = next((p for p in payouts if p.get("booking_id") == b["booking_id"]), None)
            if payout and payout["status"] == "completed":
                by_student[sid]["earned_cents"] += payout["amount_cents"]
    
    # Group by month
    by_month = {}
    for b in bookings:
        created = b.get("created_at")
        if created:
            if isinstance(created, str):
                created = datetime.fromisoformat(created.replace('Z', '+00:00'))
            month_key = created.strftime("%Y-%m")
            if month_key not in by_month:
                by_month[month_key] = {"month": month_key, "sessions": 0, "earned_cents": 0}
            by_month[month_key]["sessions"] += 1
            payout = next((p for p in payouts if p.get("booking_id") == b["booking_id"]), None)
            if payout and payout["status"] == "completed":
                by_month[month_key]["earned_cents"] += payout["amount_cents"]
    
    return {
        "summary": {
            "total_sessions": total_sessions,
            "completed_sessions": completed_sessions,
            "upcoming_sessions": upcoming_sessions,
            "canceled_sessions": canceled_sessions,
            "total_earned_cents": total_earned_cents,
            "pending_cents": pending_cents,
            "total_platform_fees_cents": total_fees_cents,
            "currency": market_config["currency"],
            "currency_symbol": market_config["currency_symbol"]
        },
        "by_student": list(by_student.values()),
        "by_month": sorted(by_month.values(), key=lambda x: x["month"], reverse=True),
        "bookings": bookings[:50],  # Last 50 bookings
        "payouts": payouts[:50]  # Last 50 payouts
    }

@api_router.get("/reports/consumer/pdf")
async def get_consumer_report_pdf(
    request: Request,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Generate PDF report for consumer"""
    user = await require_auth(request)
    
    # Get report data
    report = await get_consumer_report(request, start_date, end_date)
    
    # Generate PDF
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
    except ImportError:
        raise HTTPException(status_code=500, detail="PDF generation not available")
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=72)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=24, spaceAfter=30)
    heading_style = ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=16, spaceAfter=12)
    
    story = []
    
    # Title
    story.append(Paragraph("Maestro Hub - Session Report", title_style))
    story.append(Paragraph(f"Report for: {user.name}", styles['Normal']))
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles['Normal']))
    story.append(Spacer(1, 20))
    
    # Summary
    story.append(Paragraph("Summary", heading_style))
    summary = report["summary"]
    symbol = summary["currency_symbol"]
    
    summary_data = [
        ["Total Sessions", str(summary["total_sessions"])],
        ["Completed", str(summary["completed_sessions"])],
        ["Upcoming", str(summary["upcoming_sessions"])],
        ["Canceled", str(summary["canceled_sessions"])],
        ["Total Spent", f"{symbol}{summary['total_spent_cents']/100:.2f}"]
    ]
    
    summary_table = Table(summary_data, colWidths=[3*inch, 2*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.whitesmoke),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 20))
    
    # By Tutor
    if report["by_tutor"]:
        story.append(Paragraph("Sessions by Tutor", heading_style))
        tutor_data = [["Tutor", "Sessions", "Amount"]]
        for t in report["by_tutor"]:
            tutor_data.append([t["tutor_name"], str(t["sessions"]), f"{symbol}{t['spent_cents']/100:.2f}"])
        
        tutor_table = Table(tutor_data, colWidths=[3*inch, 1.5*inch, 1.5*inch])
        tutor_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563eb')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(tutor_table)
        story.append(Spacer(1, 20))
    
    # By Month
    if report["by_month"]:
        story.append(Paragraph("Monthly Breakdown", heading_style))
        month_data = [["Month", "Sessions", "Amount"]]
        for m in report["by_month"][:12]:  # Last 12 months
            month_data.append([m["month"], str(m["sessions"]), f"{symbol}{m['spent_cents']/100:.2f}"])
        
        month_table = Table(month_data, colWidths=[3*inch, 1.5*inch, 1.5*inch])
        month_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563eb')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(month_table)
    
    doc.build(story)
    buffer.seek(0)
    
    filename = f"maestrohub_report_{datetime.now().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@api_router.get("/reports/provider/pdf")
async def get_provider_report_pdf(
    request: Request,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Generate PDF report for tutor"""
    user = await require_tutor(request)
    
    # Get report data
    report = await get_provider_report(request, start_date, end_date)
    
    # Generate PDF
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
    except ImportError:
        raise HTTPException(status_code=500, detail="PDF generation not available")
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=72)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=24, spaceAfter=30)
    heading_style = ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=16, spaceAfter=12)
    
    story = []
    
    # Title
    story.append(Paragraph("Maestro Hub - Earnings Report", title_style))
    story.append(Paragraph(f"Report for: {user.name}", styles['Normal']))
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles['Normal']))
    story.append(Spacer(1, 20))
    
    # Summary
    story.append(Paragraph("Summary", heading_style))
    summary = report["summary"]
    symbol = summary["currency_symbol"]
    
    summary_data = [
        ["Total Sessions", str(summary["total_sessions"])],
        ["Completed", str(summary["completed_sessions"])],
        ["Upcoming", str(summary["upcoming_sessions"])],
        ["Canceled", str(summary["canceled_sessions"])],
        ["Total Earned", f"{symbol}{summary['total_earned_cents']/100:.2f}"],
        ["Pending Payout", f"{symbol}{summary['pending_cents']/100:.2f}"],
        ["Platform Fees", f"{symbol}{summary['total_platform_fees_cents']/100:.2f}"]
    ]
    
    summary_table = Table(summary_data, colWidths=[3*inch, 2*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.whitesmoke),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 20))
    
    # By Student
    if report["by_student"]:
        story.append(Paragraph("Sessions by Student", heading_style))
        student_data = [["Student", "Sessions", "Earned"]]
        for s in report["by_student"]:
            student_data.append([s["student_name"], str(s["sessions"]), f"{symbol}{s['earned_cents']/100:.2f}"])
        
        student_table = Table(student_data, colWidths=[3*inch, 1.5*inch, 1.5*inch])
        student_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563eb')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(student_table)
        story.append(Spacer(1, 20))
    
    # By Month
    if report["by_month"]:
        story.append(Paragraph("Monthly Earnings", heading_style))
        month_data = [["Month", "Sessions", "Earned"]]
        for m in report["by_month"][:12]:
            month_data.append([m["month"], str(m["sessions"]), f"{symbol}{m['earned_cents']/100:.2f}"])
        
        month_table = Table(month_data, colWidths=[3*inch, 1.5*inch, 1.5*inch])
        month_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563eb')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(month_table)
    
    doc.build(story)
    buffer.seek(0)
    
    filename = f"maestrohub_earnings_{datetime.now().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# ============== CATEGORIES ==============

@api_router.get("/categories")
async def get_categories():
    return {
        "categories": [
            # Coaching & Personal Growth
            {"id": "coaching_personal", "name": "Coaching & Personal Growth", "subjects": [
                "Life Coaching", "Executive Coaching", "Career Coaching", "Leadership Coaching", 
                "Agile Coaching", "Personal Development", "Confidence Coaching", 
                "Transformational Coaching", "Motivational Coaching", "Public Speaking"
            ]},
            # Health, Mindfulness & Wellbeing
            {"id": "health_mindfulness", "name": "Health, Mindfulness & Wellbeing", "subjects": [
                "Health Coaching", "Wellness Coaching", "Mindfulness", "Meditation", 
                "Spiritual Coaching", "Stress Management", "Mindset Coaching"
            ]},
            # Fitness & Nutrition
            {"id": "fitness_nutrition", "name": "Fitness & Nutrition", "subjects": [
                "Fitness Training", "Nutrition Coaching", "Weight Loss", "Recovery Coaching"
            ]},
            # Relationships & Family
            {"id": "relationships_family", "name": "Relationships & Family", "subjects": [
                "Relationship Coaching", "Marriage Coaching", "Parenting Coaching", 
                "Fertility Coaching", "Divorce Coaching", "Grief Coaching"
            ]},
            # Business, Communication & Growth (removed Writing)
            {"id": "business_communication", "name": "Business, Communication & Growth", "subjects": [
                "Sales Coaching", "Marketing Coaching", "Branding", "Communication Coaching", 
                "Productivity Coaching", "Business Strategy", "Image Consulting", "Personal Style"
            ]},
            # Finance, Legal & Negotiation
            {"id": "finance_legal", "name": "Finance, Legal & Negotiation", "subjects": [
                "Financial Planning", "Investment Coaching", "Retirement Planning", 
                "Real Estate Coaching", "Legal Coaching", "Negotiation Coaching"
            ]},
            # Culture, Inclusion & Experiences
            {"id": "culture_inclusion", "name": "Culture, Inclusion & Experiences", "subjects": [
                "Diversity & Inclusion", "Team-Building", "Travel Coaching"
            ]},
            # Performance & Creative Arts
            {"id": "performance_arts", "name": "Performance & Creative Arts", "subjects": [
                "Performance Coaching", "Sports", "Music", "Acting", "Voice", "Dance", 
                "Stage Presence & Theatre", "Piano", "Guitar", "Violin", "Drums", "Music Theory"
            ]},
            # Academics
            {"id": "academics", "name": "Academics", "subjects": [
                "Homework Support", "Mathematics", "Advanced Mathematics", "Science", 
                "Coding/Programming", "Languages & Writing", "Social Studies & Humanities", 
                "Test Prep", "Study & Academic Skills"
            ]},
            # Activities & Hobbies
            {"id": "activities_hobbies", "name": "Activities & Hobbies", "subjects": [
                "Art & Design", "Yoga", "STEM & Interest Clubs", "Debates", "Photography", 
                "Cooking & Baking", "Games", "Memory Training"
            ]}
        ],
        "levels": [
            {"id": "beginner", "name": "Beginner"},
            {"id": "intermediate", "name": "Intermediate"},
            {"id": "advanced", "name": "Advanced"},
            {"id": "elementary", "name": "Elementary (K-5)"},
            {"id": "middle_school", "name": "Middle School (6-8)"},
            {"id": "high_school", "name": "High School (9-12)"},
            {"id": "college", "name": "College"},
            {"id": "adult", "name": "Adult"},
            {"id": "professional", "name": "Professional"}
        ],
        "modalities": [
            {"id": "online", "name": "Online"},
            {"id": "in_person", "name": "In-Person"},
            {"id": "hybrid", "name": "Hybrid"}
        ]
    }

# ============== MARKET ROUTES ==============

@api_router.get("/markets")
async def get_markets():
    """Get all available markets"""
    markets = []
    for market_id, config in MARKETS_CONFIG.items():
        if config["is_enabled"]:
            markets.append(Market(**config))
    return {"markets": markets}

@api_router.get("/markets/{market_id}")
async def get_market(market_id: str):
    """Get a specific market configuration"""
    if market_id not in MARKETS_CONFIG:
        raise HTTPException(status_code=404, detail="Market not found")
    
    config = MARKETS_CONFIG[market_id]
    if not config["is_enabled"]:
        raise HTTPException(status_code=404, detail="Market is disabled")
    
    return Market(**config)

@api_router.get("/geo/detect")
async def detect_country_from_ip(request: Request):
    """Detect country from IP address using free geolocation API"""
    # Get client IP
    client_ip = request.headers.get("X-Forwarded-For", request.client.host)
    if client_ip and "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()
    
    # Skip for localhost/private IPs
    if client_ip in ["127.0.0.1", "localhost"] or client_ip.startswith("192.168.") or client_ip.startswith("10."):
        return {
            "detected_country": "US",
            "suggested_market_id": "US_USD",
            "ip": client_ip,
            "source": "default"
        }
    
    try:
        # Use ip-api.com free service (no API key required)
        async with httpx.AsyncClient() as client:
            response = await client.get(f"http://ip-api.com/json/{client_ip}?fields=status,countryCode")
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "success":
                    country_code = data.get("countryCode", "US")
                    market_id = COUNTRY_TO_MARKET.get(country_code, COUNTRY_TO_MARKET["default"])
                    return {
                        "detected_country": country_code,
                        "suggested_market_id": market_id,
                        "ip": client_ip,
                        "source": "ip-api"
                    }
    except Exception as e:
        logger.error(f"IP geolocation failed: {e}")
    
    # Fallback to US
    return {
        "detected_country": "US",
        "suggested_market_id": "US_USD",
        "ip": client_ip,
        "source": "default"
    }

@api_router.post("/me/market")
async def set_consumer_market(data: MarketSetRequest, request: Request):
    """Set or update consumer's market"""
    user = await require_auth(request)
    
    # Validate market exists and is enabled
    if data.market_id not in MARKETS_CONFIG:
        raise HTTPException(status_code=400, detail="Invalid market ID")
    
    if not MARKETS_CONFIG[data.market_id]["is_enabled"]:
        raise HTTPException(status_code=400, detail="Market is not available")
    
    # Check if market switching is allowed (if user already has a market)
    existing_user = await db.users.find_one({"user_id": user.user_id})
    if existing_user.get("market_id") and not FEATURE_FLAGS["MARKET_SWITCHING_ENABLED"]:
        raise HTTPException(status_code=400, detail="Market switching is not allowed")
    
    market_config = MARKETS_CONFIG[data.market_id]
    
    # Update user's market
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {
            "market_id": data.market_id,
            "country": market_config["country"],
            "timezone": market_config["default_timezone"],
            "market_updated_at": datetime.now(timezone.utc)
        }}
    )
    
    # Log the action
    await db.audit_logs.insert_one({
        "action": "set_consumer_market",
        "target_id": user.user_id,
        "actor_id": user.user_id,
        "market_id": data.market_id,
        "previous_market_id": existing_user.get("market_id"),
        "created_at": datetime.now(timezone.utc)
    })
    
    return {
        "message": "Market updated successfully",
        "market_id": data.market_id,
        "market": Market(**market_config)
    }

@api_router.get("/me/market")
async def get_consumer_market(request: Request):
    """Get current consumer's market"""
    user = await require_auth(request)
    
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    market_id = user_doc.get("market_id")
    
    if not market_id:
        return {
            "market_id": None,
            "market": None,
            "needs_selection": True
        }
    
    if market_id in MARKETS_CONFIG:
        return {
            "market_id": market_id,
            "market": Market(**MARKETS_CONFIG[market_id]),
            "needs_selection": False
        }
    
    return {
        "market_id": market_id,
        "market": None,
        "needs_selection": True
    }

@api_router.post("/providers/market")
async def set_provider_market(data: ProviderMarketSetRequest, request: Request):
    """Set provider's market based on payout country"""
    user = await require_auth(request)
    
    # Validate payout country
    payout_country = data.payout_country.upper()
    if payout_country not in COUNTRY_TO_MARKET:
        raise HTTPException(status_code=400, detail="Invalid payout country. Supported: US, IN")
    
    market_id = COUNTRY_TO_MARKET[payout_country]
    market_config = MARKETS_CONFIG[market_id]
    
    # Check if user has a tutor profile
    tutor = await db.tutors.find_one({"user_id": user.user_id})
    
    if tutor:
        # Update existing tutor profile
        await db.tutors.update_one(
            {"user_id": user.user_id},
            {"$set": {
                "payout_country": payout_country,
                "market_id": market_id,
                "timezone": market_config["default_timezone"],
                "market_updated_at": datetime.now(timezone.utc)
            }}
        )
    else:
        raise HTTPException(status_code=404, detail="Tutor profile not found. Create a profile first.")
    
    # Log the action
    await db.audit_logs.insert_one({
        "action": "set_provider_market",
        "target_id": user.user_id,
        "actor_id": user.user_id,
        "payout_country": payout_country,
        "market_id": market_id,
        "created_at": datetime.now(timezone.utc)
    })
    
    return {
        "message": "Provider market updated successfully",
        "market_id": market_id,
        "payout_country": payout_country,
        "market": Market(**market_config)
    }

@api_router.get("/providers/market")
async def get_provider_market(request: Request):
    """Get current provider's market"""
    user = await require_auth(request)
    
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")
    
    market_id = tutor.get("market_id")
    payout_country = tutor.get("payout_country")
    
    if not market_id:
        return {
            "market_id": None,
            "payout_country": None,
            "market": None,
            "needs_selection": True
        }
    
    if market_id in MARKETS_CONFIG:
        return {
            "market_id": market_id,
            "payout_country": payout_country,
            "market": Market(**MARKETS_CONFIG[market_id]),
            "needs_selection": False
        }
    
    return {
        "market_id": market_id,
        "payout_country": payout_country,
        "market": None,
        "needs_selection": True
    }

# ============== ADMIN MARKET ROUTES ==============

@api_router.get("/admin/markets")
async def admin_get_markets(request: Request):
    """Admin: Get all markets with stats"""
    await require_admin(request)
    
    markets_with_stats = []
    for market_id, config in MARKETS_CONFIG.items():
        # Get stats for this market
        tutor_count = await db.tutors.count_documents({"market_id": market_id, "is_published": True})
        consumer_count = await db.users.count_documents({"market_id": market_id, "role": "consumer"})
        booking_count = await db.bookings.count_documents({"market_id": market_id})
        
        # Get revenue
        bookings = await db.bookings.find(
            {"market_id": market_id, "status": "completed"},
            {"price_snapshot": 1}
        ).to_list(10000)
        total_revenue = sum(b.get("price_snapshot", 0) for b in bookings)
        
        markets_with_stats.append({
            **config,
            "stats": {
                "published_tutors": tutor_count,
                "consumers": consumer_count,
                "total_bookings": booking_count,
                "total_revenue": total_revenue
            }
        })
    
    return {"markets": markets_with_stats}

@api_router.post("/admin/markets/{market_id}/toggle")
async def admin_toggle_market(market_id: str, request: Request):
    """Admin: Enable/disable a market"""
    user = await require_admin(request)
    
    if market_id not in MARKETS_CONFIG:
        raise HTTPException(status_code=404, detail="Market not found")
    
    # Note: In production, this would update a database. For now, we log the intent.
    current_status = MARKETS_CONFIG[market_id]["is_enabled"]
    
    await db.audit_logs.insert_one({
        "action": "toggle_market",
        "target_id": market_id,
        "actor_id": user.user_id,
        "from_enabled": current_status,
        "to_enabled": not current_status,
        "created_at": datetime.now(timezone.utc)
    })
    
    return {
        "message": f"Market toggle logged. Restart required to apply changes.",
        "market_id": market_id,
        "current_status": current_status
    }

@api_router.post("/admin/providers/{tutor_id}/market")
async def admin_override_provider_market(tutor_id: str, data: MarketSetRequest, reason: str = "", request: Request = None):
    """Admin: Override a provider's market (with audit log)"""
    user = await require_admin(request)
    
    tutor = await db.tutors.find_one({"tutor_id": tutor_id})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor not found")
    
    if data.market_id not in MARKETS_CONFIG:
        raise HTTPException(status_code=400, detail="Invalid market ID")
    
    old_market_id = tutor.get("market_id")
    
    await db.tutors.update_one(
        {"tutor_id": tutor_id},
        {"$set": {
            "market_id": data.market_id,
            "market_override": True,
            "market_updated_at": datetime.now(timezone.utc)
        }}
    )
    
    await db.audit_logs.insert_one({
        "action": "admin_override_provider_market",
        "target_id": tutor_id,
        "actor_id": user.user_id,
        "from_market_id": old_market_id,
        "to_market_id": data.market_id,
        "reason": reason,
        "created_at": datetime.now(timezone.utc)
    })
    
    return {
        "message": "Provider market updated by admin",
        "tutor_id": tutor_id,
        "old_market_id": old_market_id,
        "new_market_id": data.market_id
    }

# ============== PRICING POLICY ROUTES ==============

@api_router.get("/pricing-policies")
async def get_pricing_policies():
    """Get pricing policies for all markets"""
    policies = await db.pricing_policies.find({}, {"_id": 0}).to_list(100)
    return {"policies": policies}

@api_router.get("/pricing-policies/{market_id}")
async def get_pricing_policy(market_id: str):
    """Get pricing policy for a specific market"""
    policy = await db.pricing_policies.find_one({"market_id": market_id}, {"_id": 0})
    if not policy:
        # Return default policy
        return {
            "policy_id": f"policy_{market_id}",
            "market_id": market_id,
            "trial_days": 90,
            "trial_free_until_first_booking": True,
            "nsf_amount_cents": 500 if market_id == "US_USD" else 500,
            "provider_fee_percent": 0.0,
            "consumer_fee_percent": 0.0,
            "pro_subscription_price_cents": None
        }
    return policy

@api_router.post("/admin/pricing-policies/{market_id}")
async def admin_update_pricing_policy(market_id: str, request: Request):
    """Admin: Update pricing policy for a market"""
    user = await require_admin(request)
    
    if market_id not in MARKETS_CONFIG:
        raise HTTPException(status_code=404, detail="Market not found")
    
    body = await request.json()
    
    policy_id = f"policy_{market_id}"
    policy_doc = {
        "policy_id": policy_id,
        "market_id": market_id,
        "trial_days": body.get("trial_days", 90),
        "trial_free_until_first_booking": body.get("trial_free_until_first_booking", True),
        "nsf_amount_cents": body.get("nsf_amount_cents", 500),
        "provider_fee_percent": body.get("provider_fee_percent", 0.0),
        "consumer_fee_percent": body.get("consumer_fee_percent", 0.0),
        "pro_subscription_price_cents": body.get("pro_subscription_price_cents"),
        "updated_at": datetime.now(timezone.utc),
        "updated_by": user.user_id
    }
    
    await db.pricing_policies.update_one(
        {"market_id": market_id},
        {"$set": policy_doc},
        upsert=True
    )
    
    return {"message": "Pricing policy updated", "policy": policy_doc}

# ============== MARKET ANALYTICS ROUTES ==============

@api_router.get("/admin/analytics/markets")
async def admin_get_market_analytics(request: Request, market_id: Optional[str] = None):
    """Admin: Get market analytics dashboard data"""
    await require_admin(request)
    
    markets_to_analyze = [market_id] if market_id else list(MARKETS_CONFIG.keys())
    
    analytics = {}
    for mid in markets_to_analyze:
        if mid not in MARKETS_CONFIG:
            continue
        
        # Supply metrics
        published_tutors = await db.tutors.count_documents({"market_id": mid, "is_published": True, "status": "approved"})
        pending_tutors = await db.tutors.count_documents({"market_id": mid, "status": "pending"})
        
        # Count tutors with availability in next 7 days
        # (simplified - in production would check availability_rules)
        active_tutors = published_tutors
        
        # Demand metrics
        total_consumers = await db.users.count_documents({"market_id": mid, "role": "consumer"})
        
        # Booking funnel
        total_bookings = await db.bookings.count_documents({"market_id": mid})
        completed_bookings = await db.bookings.count_documents({"market_id": mid, "status": "completed"})
        canceled_bookings = await db.bookings.count_documents({
            "market_id": mid, 
            "status": {"$in": ["canceled_by_consumer", "canceled_by_provider"]}
        })
        
        # Revenue
        revenue_pipeline = [
            {"$match": {"market_id": mid, "status": "completed"}},
            {"$group": {"_id": None, "total": {"$sum": "$price_snapshot"}}}
        ]
        revenue_result = await db.bookings.aggregate(revenue_pipeline).to_list(1)
        total_revenue = revenue_result[0]["total"] if revenue_result else 0
        
        analytics[mid] = {
            "market_id": mid,
            "market_name": MARKETS_CONFIG[mid]["country"],
            "currency": MARKETS_CONFIG[mid]["currency"],
            "supply": {
                "published_tutors": published_tutors,
                "pending_tutors": pending_tutors,
                "active_tutors_with_availability": active_tutors
            },
            "demand": {
                "total_consumers": total_consumers
            },
            "bookings": {
                "total": total_bookings,
                "completed": completed_bookings,
                "canceled": canceled_bookings,
                "completion_rate": round(completed_bookings / total_bookings * 100, 1) if total_bookings > 0 else 0
            },
            "revenue": {
                "total": total_revenue,
                "currency": MARKETS_CONFIG[mid]["currency"]
            }
        }
    
    return {"analytics": analytics}

# ============== HEALTH CHECK ==============

@api_router.get("/")
async def root():
    return {"message": "Maestro Hub API", "version": "1.0.0"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# ============== NOTIFICATIONS & REMINDERS ==============

class ContactRequest(BaseModel):
    subject: str
    message: str
    category: str = "general"  # general, billing, technical, feedback

@api_router.get("/notifications")
async def get_notifications(request: Request):
    """Get user notifications"""
    user = await require_auth(request)
    
    notifications = await db.notifications.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Generate some system notifications if none exist
    if not notifications:
        # Check for payment completions, session cancellations, etc.
        recent_bookings = await db.bookings.find(
            {"consumer_id": user.user_id, "payment_status": "paid"},
            {"_id": 0}
        ).sort("created_at", -1).limit(5).to_list(5)
        
        for booking in recent_bookings:
            notifications.append({
                "notification_id": f"notif_{uuid.uuid4().hex[:8]}",
                "user_id": user.user_id,
                "type": "payment_completed",
                "title": "Payment Completed",
                "message": f"Your payment of ${booking.get('amount_cents', 0)/100:.2f} was successful",
                "data": {"booking_id": booking.get("booking_id")},
                "read": False,
                "created_at": booking.get("created_at", datetime.now(timezone.utc))
            })
    
    # Add system maintenance notification
    notifications.insert(0, {
        "notification_id": "system_maintenance",
        "user_id": user.user_id,
        "type": "system_maintenance",
        "title": "System Update",
        "message": "Platform improvements deployed successfully",
        "data": {},
        "read": True,
        "created_at": datetime.now(timezone.utc) - timedelta(days=1)
    })
    
    unread_count = len([n for n in notifications if not n.get("read", False)])
    
    return {
        "notifications": notifications,
        "unread_count": unread_count
    }

@api_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, request: Request):
    """Mark notification as read"""
    user = await require_auth(request)
    
    await db.notifications.update_one(
        {"notification_id": notification_id, "user_id": user.user_id},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc)}}
    )
    
    return {"success": True}

@api_router.get("/reminders")
async def get_reminders(request: Request):
    """Get user reminders for upcoming sessions, payments, etc."""
    user = await require_auth(request)
    
    reminders = []
    now = datetime.now(timezone.utc)
    
    # Get upcoming bookings (next 7 days)
    upcoming_cutoff = now + timedelta(days=7)
    
    # For consumers
    if user.role == "consumer":
        bookings = await db.bookings.find({
            "consumer_id": user.user_id,
            "status": {"$in": ["booked", "confirmed"]},
            "start_at": {"$gte": now.isoformat(), "$lte": upcoming_cutoff.isoformat()}
        }, {"_id": 0}).to_list(20)
        
        for booking in bookings:
            tutor = await db.tutors.find_one({"tutor_id": booking["tutor_id"]}, {"_id": 0})
            tutor_user = await db.users.find_one({"user_id": tutor["user_id"]}, {"_id": 0}) if tutor else None
            
            start_at = booking.get("start_at")
            if isinstance(start_at, str):
                start_dt = datetime.fromisoformat(start_at.replace('Z', '+00:00'))
            else:
                start_dt = start_at
            
            hours_until = (start_dt - now).total_seconds() / 3600
            
            reminders.append({
                "reminder_id": f"session_{booking['booking_id']}",
                "type": "upcoming_session",
                "title": "Upcoming Session",
                "message": f"Session with {tutor_user['name'] if tutor_user else 'Tutor'} in {int(hours_until)} hours",
                "due_at": start_at,
                "priority": "high" if hours_until < 24 else "medium",
                "data": {"booking_id": booking["booking_id"]}
            })
    
    # For tutors
    elif user.role == "tutor":
        tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
        if tutor:
            bookings = await db.bookings.find({
                "tutor_id": tutor["tutor_id"],
                "status": {"$in": ["booked", "confirmed"]},
                "start_at": {"$gte": now.isoformat(), "$lte": upcoming_cutoff.isoformat()}
            }, {"_id": 0}).to_list(20)
            
            for booking in bookings:
                student = await db.students.find_one({"student_id": booking.get("student_id")}, {"_id": 0})
                
                start_at = booking.get("start_at")
                if isinstance(start_at, str):
                    start_dt = datetime.fromisoformat(start_at.replace('Z', '+00:00'))
                else:
                    start_dt = start_at
                
                hours_until = (start_dt - now).total_seconds() / 3600
                
                reminders.append({
                    "reminder_id": f"session_{booking['booking_id']}",
                    "type": "upcoming_session",
                    "title": "Upcoming Session",
                    "message": f"Session with {student['name'] if student else 'Student'} in {int(hours_until)} hours",
                    "due_at": start_at,
                    "priority": "high" if hours_until < 24 else "medium",
                    "data": {"booking_id": booking["booking_id"]}
                })
    
    # Sort by due date
    reminders.sort(key=lambda x: x.get("due_at", ""))
    
    return {
        "reminders": reminders,
        "total": len(reminders)
    }

@api_router.post("/contact")
async def submit_contact_request(data: ContactRequest, request: Request):
    """Submit a contact request"""
    user = await require_auth(request)
    
    contact_id = f"contact_{uuid.uuid4().hex[:12]}"
    
    contact_doc = {
        "contact_id": contact_id,
        "user_id": user.user_id,
        "user_name": user.name,
        "user_email": user.email,
        "subject": data.subject,
        "message": data.message,
        "category": data.category,
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.contact_requests.insert_one(contact_doc)
    
    # Create notification for user
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:8]}",
        "user_id": user.user_id,
        "type": "contact_received",
        "title": "Contact Request Received",
        "message": f"We received your message about: {data.subject}. We'll respond within 24-48 hours.",
        "data": {"contact_id": contact_id},
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })
    
    return {
        "success": True,
        "contact_id": contact_id,
        "message": "Your message has been received. We'll respond within 24-48 hours."
    }

# Admin inbox for contact messages
@api_router.get("/admin/inbox")
async def admin_get_inbox(request: Request, status: Optional[str] = None, limit: int = 50, skip: int = 0):
    """Get all contact messages for admin inbox"""
    await require_admin(request)
    
    query: Dict[str, Any] = {}
    if status:
        query["status"] = status
    
    cursor = db.contact_requests.find(query).sort("created_at", -1).skip(skip).limit(limit)
    messages = await cursor.to_list(length=limit)
    
    total = await db.contact_requests.count_documents(query)
    pending_count = await db.contact_requests.count_documents({"status": "pending"})
    
    return {
        "messages": [
            {
                "contact_id": m.get("contact_id"),
                "user_id": m.get("user_id"),
                "user_name": m.get("user_name"),
                "user_email": m.get("user_email"),
                "subject": m.get("subject"),
                "message": m.get("message"),
                "category": m.get("category"),
                "status": m.get("status", "pending"),
                "created_at": m.get("created_at").isoformat() if m.get("created_at") else None,
                "responded_at": m.get("responded_at").isoformat() if m.get("responded_at") else None,
            }
            for m in messages
        ],
        "total": total,
        "pending_count": pending_count,
        "has_more": (skip + limit) < total
    }

@api_router.put("/admin/inbox/{contact_id}")
async def admin_update_contact_status(contact_id: str, status: str, response_note: Optional[str] = None, request: Request = None):
    """Update contact message status"""
    await require_admin(request)
    
    update_data: Dict[str, Any] = {"status": status}
    if status == "resolved":
        update_data["responded_at"] = datetime.now(timezone.utc)
    if response_note:
        update_data["admin_response"] = response_note
    
    result = await db.contact_requests.update_one(
        {"contact_id": contact_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Contact message not found")
    
    return {"success": True, "message": f"Contact status updated to {status}"}

# ============== INVITES SYSTEM ==============

class InviteCreate(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    message: Optional[str] = None

class InviteResponse(BaseModel):
    invite_id: str
    tutor_id: str
    tutor_name: str
    email: str
    name: Optional[str]
    message: Optional[str]
    status: str  # pending, accepted, declined, expired
    created_at: datetime
    expires_at: datetime

@api_router.post("/invites")
async def create_invite(data: InviteCreate, request: Request):
    """Tutors can send invites to potential students"""
    user = await require_tutor(request)
    
    # Get tutor profile
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")
    
    # Check if invite already exists for this email from this tutor
    existing = await db.invites.find_one({
        "tutor_id": tutor["tutor_id"],
        "email": data.email.lower(),
        "status": {"$in": ["pending", "accepted"]}
    })
    if existing:
        raise HTTPException(status_code=400, detail="An invite already exists for this email")
    
    invite_id = f"inv_{uuid.uuid4().hex[:12]}"
    invite_doc = {
        "invite_id": invite_id,
        "tutor_id": tutor["tutor_id"],
        "tutor_user_id": user.user_id,
        "tutor_name": user.name,
        "email": data.email.lower(),
        "name": data.name,
        "message": data.message or f"Hi! I'd like to invite you to join Maestro Hub. I'm available for tutoring sessions.",
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=30)
    }
    
    await db.invites.insert_one(invite_doc)
    
    # Check if user exists - if so, create notification
    existing_user = await db.users.find_one({"email": data.email.lower()}, {"_id": 0})
    if existing_user:
        await db.notifications.insert_one({
            "notification_id": f"notif_{uuid.uuid4().hex[:8]}",
            "user_id": existing_user["user_id"],
            "type": "invite_received",
            "title": "New Tutor Invitation",
            "message": f"{user.name} has invited you to connect on Maestro Hub!",
            "data": {"invite_id": invite_id, "tutor_id": tutor["tutor_id"]},
            "read": False,
            "created_at": datetime.now(timezone.utc)
        })
    
    return {
        "success": True,
        "invite_id": invite_id,
        "message": "Invite sent successfully"
    }

@api_router.get("/invites/sent")
async def get_sent_invites(request: Request):
    """Get invites sent by the tutor"""
    user = await require_tutor(request)
    
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")
    
    invites = await db.invites.find(
        {"tutor_id": tutor["tutor_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"invites": invites}

@api_router.get("/invites/received")
async def get_received_invites(request: Request):
    """Get invites received by the consumer"""
    user = await require_auth(request)
    
    invites = await db.invites.find(
        {"email": user.email.lower(), "status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich with tutor info
    enriched = []
    for invite in invites:
        tutor = await db.tutors.find_one({"tutor_id": invite["tutor_id"]}, {"_id": 0})
        if tutor:
            enriched.append({
                **invite,
                "tutor_bio": tutor.get("bio", ""),
                "tutor_subjects": tutor.get("subjects", []),
                "tutor_rating": tutor.get("rating_avg", 0)
            })
    
    return {"invites": enriched}

@api_router.post("/invites/{invite_id}/accept")
async def accept_invite(invite_id: str, request: Request):
    """Consumer accepts an invite from a tutor"""
    user = await require_auth(request)
    
    invite = await db.invites.find_one({
        "invite_id": invite_id,
        "email": user.email.lower()
    }, {"_id": 0})
    
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    
    if invite["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Invite is already {invite['status']}")
    
    # Check expiry
    expires_at = invite["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        await db.invites.update_one(
            {"invite_id": invite_id},
            {"$set": {"status": "expired"}}
        )
        raise HTTPException(status_code=400, detail="Invite has expired")
    
    # Update invite status
    await db.invites.update_one(
        {"invite_id": invite_id},
        {"$set": {
            "status": "accepted",
            "accepted_at": datetime.now(timezone.utc),
            "accepted_by_user_id": user.user_id
        }}
    )
    
    # Notify tutor
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:8]}",
        "user_id": invite["tutor_user_id"],
        "type": "invite_accepted",
        "title": "Invite Accepted!",
        "message": f"{user.name} has accepted your invitation!",
        "data": {"invite_id": invite_id, "consumer_id": user.user_id},
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })
    
    return {
        "success": True,
        "message": "Invite accepted! You can now book sessions with this tutor.",
        "tutor_id": invite["tutor_id"]
    }

@api_router.post("/invites/{invite_id}/decline")
async def decline_invite(invite_id: str, request: Request):
    """Consumer declines an invite"""
    user = await require_auth(request)
    
    invite = await db.invites.find_one({
        "invite_id": invite_id,
        "email": user.email.lower()
    }, {"_id": 0})
    
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    
    if invite["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Invite is already {invite['status']}")
    
    await db.invites.update_one(
        {"invite_id": invite_id},
        {"$set": {
            "status": "declined",
            "declined_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"success": True, "message": "Invite declined"}

@api_router.delete("/invites/{invite_id}")
async def cancel_invite(invite_id: str, request: Request):
    """Tutor cancels/deletes an invite they sent"""
    user = await require_tutor(request)
    
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")
    
    result = await db.invites.delete_one({
        "invite_id": invite_id,
        "tutor_id": tutor["tutor_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invite not found")
    
    return {"success": True, "message": "Invite cancelled"}


# ============== SEED DATA ==============
@api_router.post("/admin/seed-bookings")
async def seed_bookings(request: Request):
    """Create seed booking data for testing"""
    user = await require_admin(request)
    
    # Get all tutors and consumers
    tutors = await db.tutors.find({"status": "approved"}, {"_id": 0}).to_list(10)
    consumers = await db.users.find({"role": "consumer"}, {"_id": 0}).to_list(10)
    
    if not tutors:
        raise HTTPException(status_code=400, detail="No approved tutors found")
    if not consumers:
        raise HTTPException(status_code=400, detail="No consumers found")
    
    bookings_created = []
    
    for i, tutor in enumerate(tutors[:3]):
        consumer = consumers[i % len(consumers)]
        
        # Get or create a student for this consumer
        student = await db.students.find_one({"user_id": consumer["user_id"]}, {"_id": 0})
        if not student:
            student = {
                "student_id": f"student_{uuid.uuid4().hex[:8]}",
                "user_id": consumer["user_id"],
                "name": f"Test Child {i+1}",
                "age_group": "6-12",
                "notes": "Created for testing",
                "created_at": datetime.now(timezone.utc)
            }
            await db.students.insert_one(student)
        
        # Create a booking for each status
        for j, status in enumerate(["booked", "completed", "cancelled"]):
            booking_date = datetime.now(timezone.utc) + timedelta(days=(j-1)*7)
            amount = tutor.get("base_price", 50) * 100
            
            booking = {
                "booking_id": f"booking_{uuid.uuid4().hex[:12]}",
                "tutor_id": tutor["tutor_id"],
                "consumer_id": consumer["user_id"],
                "student_id": student["student_id"],
                "market_id": tutor.get("market_id", "US_USD"),
                "currency": "USD",
                "start_at": booking_date,
                "end_at": booking_date + timedelta(hours=1),
                "status": status,
                "price_snapshot": tutor.get("base_price", 50),
                "amount_cents": amount,
                "payment_id": f"pay_{uuid.uuid4().hex[:12]}",
                "created_at": datetime.now(timezone.utc)
            }
            
            await db.bookings.insert_one(booking)
            bookings_created.append(booking["booking_id"])
            
            # Create payment record
            payment = {
                "payment_id": booking["payment_id"],
                "booking_id": booking["booking_id"],
                "consumer_id": consumer["user_id"],
                "tutor_id": tutor["tutor_id"],
                "amount_cents": amount,
                "platform_fee_cents": int(amount * 0.15),
                "tutor_payout_cents": amount - int(amount * 0.15),
                "currency": "USD",
                "status": "completed" if status == "completed" else ("refunded" if status == "cancelled" else "pending"),
                "payment_method": "card",
                "created_at": datetime.now(timezone.utc)
            }
            await db.payments.insert_one(payment)
    
    return {"success": True, "bookings_created": len(bookings_created), "booking_ids": bookings_created}


# ============== PAYMENT SIMULATION ==============
class ManualPaymentCreate(BaseModel):
    booking_id: str
    amount_cents: int
    payment_type: str = "payment"  # "payment" or "refund"
    notes: Optional[str] = None

@api_router.post("/payments/manual")
async def create_manual_payment(data: ManualPaymentCreate, request: Request):
    """Create a manual payment or refund (for testing/admin)"""
    user = await require_auth(request)
    
    # Get booking
    booking = await db.bookings.find_one({"booking_id": data.booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Verify user is part of this booking
    if booking["consumer_id"] != user.user_id and user.role != "admin":
        # Check if user is the tutor
        tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
        if not tutor or tutor["tutor_id"] != booking["tutor_id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    payment_id = f"pay_{uuid.uuid4().hex[:12]}"
    
    if data.payment_type == "refund":
        # Create refund
        payment = {
            "payment_id": payment_id,
            "booking_id": data.booking_id,
            "consumer_id": booking["consumer_id"],
            "tutor_id": booking["tutor_id"],
            "amount_cents": -data.amount_cents,  # Negative for refunds
            "platform_fee_cents": 0,
            "tutor_payout_cents": -data.amount_cents,
            "currency": booking.get("currency", "USD"),
            "status": "refunded",
            "payment_method": "manual_refund",
            "notes": data.notes or "Manual refund",
            "created_at": datetime.now(timezone.utc)
        }
        
        # Update booking status
        await db.bookings.update_one(
            {"booking_id": data.booking_id},
            {"$set": {"status": "cancelled", "refunded_at": datetime.now(timezone.utc)}}
        )
    else:
        # Create payment
        platform_fee = int(data.amount_cents * 0.15)
        payment = {
            "payment_id": payment_id,
            "booking_id": data.booking_id,
            "consumer_id": booking["consumer_id"],
            "tutor_id": booking["tutor_id"],
            "amount_cents": data.amount_cents,
            "platform_fee_cents": platform_fee,
            "tutor_payout_cents": data.amount_cents - platform_fee,
            "currency": booking.get("currency", "USD"),
            "status": "completed",
            "payment_method": "manual_payment",
            "notes": data.notes or "Manual payment",
            "created_at": datetime.now(timezone.utc)
        }
        
        # Update booking status
        await db.bookings.update_one(
            {"booking_id": data.booking_id},
            {"$set": {"status": "completed", "paid_at": datetime.now(timezone.utc)}}
        )
    
    await db.payments.insert_one(payment)
    
    return {"success": True, "payment_id": payment_id, "payment": payment}


@api_router.get("/payments/history")
async def get_payment_history(request: Request, role: str = "consumer"):
    """Get payment history for current user"""
    user = await require_auth(request)
    
    if role == "tutor":
        tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
        if not tutor:
            return {"payments": []}
        query = {"tutor_id": tutor["tutor_id"]}
    else:
        query = {"consumer_id": user.user_id}
    
    payments = await db.payments.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Enrich with booking info
    for p in payments:
        booking = await db.bookings.find_one({"booking_id": p.get("booking_id")}, {"_id": 0})
        if booking:
            p["booking_status"] = booking.get("status")
            p["booking_date"] = booking.get("start_at")
    
    return {"payments": payments}


# Include router
app.include_router(api_router)

# Dynamic CORS allowing specific origins with credentials
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:8001",
    "https://bugbusters-mobile.preview.emergentagent.com",
    "https://bugbusters-mobile.preview.emergentagent.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.preview\.emergentagent\.com",  # Allow all preview subdomains
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
