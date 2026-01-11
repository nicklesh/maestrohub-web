from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query
from fastapi.security import HTTPBearer
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
import html
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import bcrypt
import jwt
from jwt.exceptions import InvalidTokenError, ExpiredSignatureError, DecodeError
import io

# Rate limiting
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

# Import email service
from email_service import (
    email_service, 
    booking_confirmation_email, 
    booking_cancellation_email,
    session_reminder_email,
    new_review_notification_email,
    no_show_notification_email
)

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

# ============== SECURITY: Rate Limiting ==============
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

# Rate limit exceeded handler
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please try again later."}
    )

# ============== SECURITY: Headers Middleware ==============
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        # Note: Strict-Transport-Security should be added by the reverse proxy in production
        return response

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(SlowAPIMiddleware)

# ============== SECURITY: Input Sanitization ==============
def sanitize_html(text: str) -> str:
    """Sanitize HTML content to prevent XSS"""
    if not text:
        return text
    return html.escape(text)

def sanitize_for_mongo(value: Any) -> Any:
    """Sanitize input to prevent NoSQL injection"""
    if isinstance(value, str):
        # Block MongoDB operators
        dangerous_patterns = ['$where', '$regex', '$gt', '$lt', '$ne', '$or', '$and', '$not', '$exists']
        for pattern in dangerous_patterns:
            if pattern in value.lower():
                return value.replace(pattern, '')
        return value
    elif isinstance(value, dict):
        # Recursively check for operators in dict keys
        return {k: sanitize_for_mongo(v) for k, v in value.items() if not k.startswith('$')}
    elif isinstance(value, list):
        return [sanitize_for_mongo(item) for item in value]
    return value

# ============== SECURITY: Password Validation ==============
def validate_password_strength(password: str) -> tuple[bool, str]:
    """Validate password meets security requirements"""
    if not password:
        return False, "Password is required"
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r"\d", password):
        return False, "Password must contain at least one number"
    return True, "Password is valid"

# Add validation error handler to log the actual error
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Try to get the body
    try:
        body = await request.body()
        body_str = body.decode('utf-8')[:500]
    except:
        body_str = "Could not read body"
    logger.error(f"Validation error for {request.method} {request.url.path}")
    logger.error(f"Request body: {body_str}")
    logger.error(f"Validation errors: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()}
    )

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
    meeting_link: Optional[str] = None  # Zoom/Google Meet link for online sessions
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
    is_sponsored: Optional[bool] = False  # Whether tutor has active sponsorship
    sponsored_categories: Optional[List[str]] = []  # Categories tutor is sponsored in
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

# ============== SESSION PACKAGES ==============
class SessionPackage(BaseModel):
    package_id: str = Field(default_factory=lambda: f"pkg_{uuid.uuid4().hex[:12]}")
    tutor_id: str
    name: str  # e.g., "4-Session Bundle", "Monthly Package"
    session_count: int  # Number of sessions in package
    price_per_session: float  # Price per session (can be discounted)
    total_price: float  # Total package price
    discount_percent: float = 0  # Discount percentage off regular price
    validity_days: int = 90  # How long the package is valid
    description: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None

class SessionPackageCreate(BaseModel):
    name: str
    session_count: int = Field(ge=2, le=52)
    discount_percent: float = Field(ge=0, le=50)
    validity_days: int = Field(ge=30, le=365)
    description: Optional[str] = None

class PurchasedPackage(BaseModel):
    purchase_id: str = Field(default_factory=lambda: f"pur_{uuid.uuid4().hex[:12]}")
    package_id: str
    tutor_id: str
    consumer_id: str
    student_id: str
    package_name: str
    total_sessions: int
    sessions_used: int = 0
    sessions_remaining: int
    price_paid: float
    currency: str = "USD"
    currency_symbol: str = "$"
    purchased_at: datetime
    expires_at: datetime
    status: str = "active"  # active, expired, completed

# ============== DETAILED REVIEWS ==============
class DetailedReviewCreate(BaseModel):
    booking_id: Optional[str] = None  # Can review without specific booking
    tutor_id: str
    teaching_quality: int = Field(ge=1, le=5)
    communication: int = Field(ge=1, le=5)
    punctuality: int = Field(ge=1, le=5)
    knowledge: int = Field(ge=1, le=5)
    value_for_money: int = Field(ge=1, le=5)
    comment: Optional[str] = None
    would_recommend: bool = True

class DetailedReview(DetailedReviewCreate):
    review_id: str
    consumer_id: str
    consumer_name: str
    overall_rating: float  # Average of all categories
    created_at: datetime
    coach_response: Optional[str] = None
    coach_response_at: Optional[datetime] = None

class CoachResponseCreate(BaseModel):
    response: str = Field(min_length=1, max_length=500)

# ============== SPONSORSHIP/ADVERTISING ==============
class SponsorshipPlan(BaseModel):
    plan_id: str = Field(default_factory=lambda: f"plan_{uuid.uuid4().hex[:8]}")
    name: str
    duration_days: int
    price_cents: int
    currency: str = "USD"
    description: str
    is_active: bool = True

class SponsorshipCreate(BaseModel):
    plan_id: str
    categories: List[str]  # Categories to be sponsored in
    auto_renew: bool = False

class ActiveSponsorship(BaseModel):
    sponsorship_id: str = Field(default_factory=lambda: f"spon_{uuid.uuid4().hex[:12]}")
    tutor_id: str
    plan_id: str
    plan_name: str
    categories: List[str]
    price_paid_cents: int
    platform_fee_cents: int
    currency: str
    started_at: datetime
    expires_at: datetime
    auto_renew: bool = False
    status: str = "active"  # active, expired, cancelled

# Default sponsorship plans - Weekly pricing: $15/week, $10/week from week 13
# Price logic: First 12 weeks = $15/week, weeks 13+ = $10/week
SPONSORSHIP_PLANS = [
    {"plan_id": "spon_1w", "name": "1 Week", "weeks": 1, "duration_days": 7, "price_cents": 1500, "currency": "USD", "description": "1 week of premium visibility"},
    {"plan_id": "spon_4w", "name": "4 Weeks", "weeks": 4, "duration_days": 28, "price_cents": 6000, "currency": "USD", "description": "4 weeks of top placement ($15/week)"},
    {"plan_id": "spon_8w", "name": "8 Weeks", "weeks": 8, "duration_days": 56, "price_cents": 12000, "currency": "USD", "description": "8 weeks of great exposure ($15/week)"},
    {"plan_id": "spon_12w", "name": "12 Weeks", "weeks": 12, "duration_days": 84, "price_cents": 18000, "currency": "USD", "description": "12 weeks of maximum reach ($15/week)"},
    {"plan_id": "spon_16w", "name": "16 Weeks", "weeks": 16, "duration_days": 112, "price_cents": 22000, "currency": "USD", "description": "Best value! $15/week for 12 weeks, then $10/week"},
    {"plan_id": "spon_24w", "name": "24 Weeks", "weeks": 24, "duration_days": 168, "price_cents": 30000, "currency": "USD", "description": "Best value! $15/week for 12 weeks, then $10/week"},
]

# INR pricing: ₹1200/week, ₹800/week from week 13 (approx 80x USD)
SPONSORSHIP_PLANS_INR = [
    {"plan_id": "spon_1w_inr", "name": "1 Week", "weeks": 1, "duration_days": 7, "price_cents": 120000, "currency": "INR", "description": "1 week of premium visibility"},
    {"plan_id": "spon_4w_inr", "name": "4 Weeks", "weeks": 4, "duration_days": 28, "price_cents": 480000, "currency": "INR", "description": "4 weeks of top placement (₹1200/week)"},
    {"plan_id": "spon_8w_inr", "name": "8 Weeks", "weeks": 8, "duration_days": 56, "price_cents": 960000, "currency": "INR", "description": "8 weeks of great exposure (₹1200/week)"},
    {"plan_id": "spon_12w_inr", "name": "12 Weeks", "weeks": 12, "duration_days": 84, "price_cents": 1440000, "currency": "INR", "description": "12 weeks of maximum reach (₹1200/week)"},
    {"plan_id": "spon_16w_inr", "name": "16 Weeks", "weeks": 16, "duration_days": 112, "price_cents": 1760000, "currency": "INR", "description": "Best value! ₹1200/week for 12 weeks, then ₹800/week"},
    {"plan_id": "spon_24w_inr", "name": "24 Weeks", "weeks": 24, "duration_days": 168, "price_cents": 2400000, "currency": "INR", "description": "Best value! ₹1200/week for 12 weeks, then ₹800/week"},
]

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
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt_token(token: str) -> Optional[str]:
    """
    Securely decode and validate JWT token.
    Returns user_id if valid, None if invalid.
    """
    if not token:
        return None
    
    # Basic format validation - JWT should have 3 parts separated by dots
    parts = token.split('.')
    if len(parts) != 3:
        logger.warning(f"Invalid JWT format: expected 3 parts, got {len(parts)}")
        return None
    
    try:
        payload = jwt.decode(
            token, 
            JWT_SECRET, 
            algorithms=[JWT_ALGORITHM],
            options={
                "verify_signature": True,
                "verify_exp": True,
                "require": ["user_id", "exp"]
            }
        )
        user_id = payload.get("user_id")
        if not user_id:
            logger.warning("JWT missing user_id claim")
            return None
        return user_id
    except ExpiredSignatureError:
        logger.info("JWT token expired")
        return None
    except InvalidTokenError as e:
        logger.warning(f"Invalid JWT token: {str(e)}")
        return None
    except DecodeError as e:
        logger.warning(f"JWT decode error: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Unexpected JWT error: {str(e)}")
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
    
    # Validate token is not empty or just whitespace
    if not session_token.strip():
        return None
    
    # Check if it's a JWT token
    user_id = decode_jwt_token(session_token)
    if user_id:
        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if user_doc:
            return User(**user_doc)
    
    # Check session in database (for Google OAuth sessions)
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
@limiter.limit("5/minute")
async def register(request: Request, data: UserCreate, response: Response):
    # Check if email exists
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate password strength (if password provided)
    if data.password:
        is_valid, error_msg = validate_password_strength(data.password)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
    
    # Sanitize user inputs
    sanitized_name = sanitize_html(data.name) if data.name else data.name
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": data.email,
        "name": sanitized_name,
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
@limiter.limit("5/minute")
async def login(request: Request, data: UserLogin, response: Response):
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
    
    return {"success": True, "auto_pay": data.model_dump()}

# ============== PAYMENT PROVIDERS CONFIGURATION ==============
# Market-specific payment providers (no PII stored - only provider preference)
PAYMENT_PROVIDERS_USD = [
    {"id": "paypal", "name": "PayPal", "icon": "logo-paypal"},
    {"id": "google_pay", "name": "Google Pay", "icon": "logo-google"},
    {"id": "apple_pay", "name": "Apple Pay", "icon": "logo-apple"},
    {"id": "venmo", "name": "Venmo", "icon": "phone-portrait"},
    {"id": "zelle", "name": "Zelle", "icon": "flash"},
]

PAYMENT_PROVIDERS_INR = [
    {"id": "phonepe", "name": "PhonePe", "icon": "wallet"},
    {"id": "google_pay", "name": "Google Pay (GPay)", "icon": "logo-google"},
    {"id": "paytm", "name": "Paytm", "icon": "wallet"},
    {"id": "amazon_pay", "name": "Amazon Pay", "icon": "cart"},
]

# Payment Provider Preference Model (no PII stored)
class PaymentProviderPreference(BaseModel):
    provider_id: str  # paypal, google_pay, venmo, zelle, phonepe, paytm, amazon_pay
    display_name: str
    is_default: bool = False
    linked_at: Optional[datetime] = None

class PaymentProviderAdd(BaseModel):
    provider_id: str
    is_default: bool = False

@api_router.get("/payment-providers")
async def get_payment_providers(request: Request):
    """Get available payment providers based on user's market"""
    user = await require_auth(request)
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    market_id = user_doc.get("market_id", "US_USD")
    
    # Return market-specific providers
    if market_id == "IN_INR":
        providers = PAYMENT_PROVIDERS_INR
    else:
        providers = PAYMENT_PROVIDERS_USD
    
    # Get user's linked providers
    linked_providers = user_doc.get("payment_providers", [])
    
    return {
        "available_providers": providers,
        "linked_providers": linked_providers,
        "market_id": market_id
    }

@api_router.post("/payment-providers")
async def link_payment_provider(data: PaymentProviderAdd, request: Request):
    """Link a payment provider (no PII stored - just preference)"""
    user = await require_auth(request)
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    market_id = user_doc.get("market_id", "US_USD")
    
    # Validate provider is valid for market
    valid_providers = PAYMENT_PROVIDERS_INR if market_id == "IN_INR" else PAYMENT_PROVIDERS_USD
    provider_info = next((p for p in valid_providers if p["id"] == data.provider_id), None)
    if not provider_info:
        raise HTTPException(status_code=400, detail="Invalid payment provider for your market")
    
    existing_providers = user_doc.get("payment_providers", [])
    
    # Check if already linked
    if any(p["provider_id"] == data.provider_id for p in existing_providers):
        raise HTTPException(status_code=400, detail="Provider already linked")
    
    # Set default logic
    is_default = data.is_default or len(existing_providers) == 0
    if is_default:
        for p in existing_providers:
            p["is_default"] = False
    
    new_provider = {
        "provider_id": data.provider_id,
        "display_name": provider_info["name"],
        "is_default": is_default,
        "linked_at": datetime.now(timezone.utc).isoformat()
    }
    existing_providers.append(new_provider)
    
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"payment_providers": existing_providers}}
    )
    
    return {"success": True, "provider": new_provider, "message": f"{provider_info['name']} linked successfully"}

@api_router.delete("/payment-providers/{provider_id}")
async def unlink_payment_provider(provider_id: str, request: Request):
    """Remove a linked payment provider"""
    user = await require_auth(request)
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    
    existing_providers = user_doc.get("payment_providers", [])
    provider_to_remove = next((p for p in existing_providers if p["provider_id"] == provider_id), None)
    
    if not provider_to_remove:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    updated_providers = [p for p in existing_providers if p["provider_id"] != provider_id]
    
    # If removed provider was default, set first remaining as default
    if provider_to_remove.get("is_default") and updated_providers:
        updated_providers[0]["is_default"] = True
    
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"payment_providers": updated_providers}}
    )
    
    return {"success": True, "message": "Provider unlinked"}

@api_router.put("/payment-providers/{provider_id}/default")
async def set_default_provider(provider_id: str, request: Request):
    """Set a provider as default"""
    user = await require_auth(request)
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    
    existing_providers = user_doc.get("payment_providers", [])
    found = False
    
    for p in existing_providers:
        if p["provider_id"] == provider_id:
            p["is_default"] = True
            found = True
        else:
            p["is_default"] = False
    
    if not found:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"payment_providers": existing_providers}}
    )
    
    return {"success": True, "message": "Default provider updated"}

# ============== PAYMENT PROCESSING ==============
class ProcessPaymentRequest(BaseModel):
    booking_hold_id: str
    amount_cents: int
    provider_id: Optional[str] = None  # If not provided, use default

@api_router.post("/payments/process")
async def process_payment(data: ProcessPaymentRequest, request: Request):
    """Process payment using linked provider with auto-charge and fallback logic"""
    user = await require_auth(request)
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    market_id = user_doc.get("market_id", "US_USD")
    currency = "INR" if market_id == "IN_INR" else "USD"
    
    linked_providers = user_doc.get("payment_providers", [])
    
    if not linked_providers:
        return {
            "success": False,
            "error": "no_payment_method",
            "message": "No payment method configured. Please add a payment method first.",
            "redirect_to_billing": True
        }
    
    # Get provider to charge
    provider_id = data.provider_id
    if not provider_id:
        # Use default provider
        default_provider = next((p for p in linked_providers if p.get("is_default")), None)
        if default_provider:
            provider_id = default_provider["provider_id"]
        else:
            provider_id = linked_providers[0]["provider_id"]
    
    # Get tutor's payout info for split calculation
    hold = await db.booking_holds.find_one({"hold_id": data.booking_hold_id}, {"_id": 0})
    if not hold:
        raise HTTPException(status_code=404, detail="Booking hold not found")
    
    tutor = await db.tutors.find_one({"tutor_id": hold["tutor_id"]}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Coach not found")
    
    # Calculate split: 90% to tutor, 10% platform fee
    platform_fee_percent = PLATFORM_FEE_PERCENT
    tutor_amount = int(data.amount_cents * (100 - platform_fee_percent) / 100)
    platform_fee = data.amount_cents - tutor_amount
    
    # Simulate payment processing with possible failure
    import random
    payment_success = random.random() > 0.1  # 90% success rate for simulation
    
    payment_id = f"pay_{uuid.uuid4().hex[:12]}"
    
    if payment_success:
        # Record successful payment
        payment_record = {
            "payment_id": payment_id,
            "booking_hold_id": data.booking_hold_id,
            "tutor_id": hold["tutor_id"],
            "consumer_id": user.user_id,
            "amount_cents": data.amount_cents,
            "currency": currency,
            "provider_id": provider_id,
            "platform_fee_cents": platform_fee,
            "tutor_payout_cents": tutor_amount,
            "status": "completed",
            "processed_at": datetime.now(timezone.utc)
        }
        await db.payments.insert_one(payment_record)
        
        logger.info(f"Payment {payment_id} processed: ${data.amount_cents/100:.2f} via {provider_id} (Tutor: ${tutor_amount/100:.2f}, Platform: ${platform_fee/100:.2f})")
        
        return {
            "success": True,
            "payment_id": payment_id,
            "provider_used": provider_id,
            "amount_cents": data.amount_cents,
            "currency": currency,
            "split": {
                "tutor_payout_cents": tutor_amount,
                "platform_fee_cents": platform_fee,
                "platform_fee_percent": platform_fee_percent
            }
        }
    else:
        # Payment failed - try fallback providers
        remaining_providers = [p for p in linked_providers if p["provider_id"] != provider_id]
        
        for fallback in remaining_providers:
            # Simulate fallback attempt (80% success rate)
            if random.random() > 0.2:
                payment_record = {
                    "payment_id": payment_id,
                    "booking_hold_id": data.booking_hold_id,
                    "tutor_id": hold["tutor_id"],
                    "consumer_id": user.user_id,
                    "amount_cents": data.amount_cents,
                    "currency": currency,
                    "provider_id": fallback["provider_id"],
                    "platform_fee_cents": platform_fee,
                    "tutor_payout_cents": tutor_amount,
                    "status": "completed",
                    "fallback_from": provider_id,
                    "processed_at": datetime.now(timezone.utc)
                }
                await db.payments.insert_one(payment_record)
                
                logger.info(f"Payment {payment_id} processed via fallback {fallback['provider_id']}")
                
                return {
                    "success": True,
                    "payment_id": payment_id,
                    "provider_used": fallback["provider_id"],
                    "fallback": True,
                    "original_provider": provider_id,
                    "amount_cents": data.amount_cents,
                    "currency": currency,
                    "split": {
                        "tutor_payout_cents": tutor_amount,
                        "platform_fee_cents": platform_fee,
                        "platform_fee_percent": platform_fee_percent
                    }
                }
        
        # All providers failed
        logger.warning(f"All payment providers failed for user {user.user_id}")
        return {
            "success": False,
            "error": "payment_failed",
            "message": "Payment could not be processed. All payment methods failed. Please try again or update your payment methods.",
            "tried_providers": [provider_id] + [p["provider_id"] for p in remaining_providers]
        }

# Legacy payment methods (keeping for backward compatibility)
class PaymentMethodCreate(BaseModel):
    card_type: str  # visa, mastercard, amex
    last_four: str
    expiry_month: int
    expiry_year: int
    cardholder_name: str
    is_default: bool = False

@api_router.get("/payment-methods")
async def get_payment_methods(request: Request):
    """Get user's saved payment methods (legacy - use /payment-providers instead)"""
    user = await require_auth(request)
    
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    payment_methods = user_doc.get("payment_methods", [])
    payment_providers = user_doc.get("payment_providers", [])
    
    return {
        "payment_methods": payment_methods,
        "payment_providers": payment_providers
    }

@api_router.post("/payment-methods")
async def add_payment_method(data: PaymentMethodCreate, request: Request):
    """Add a new payment method (legacy)"""
    user = await require_auth(request)
    
    # Generate a mock payment method ID (in production, this comes from Stripe)
    payment_method_id = f"pm_{uuid.uuid4().hex[:24]}"
    
    # Get current user document
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    existing_methods = user_doc.get("payment_methods") or []
    
    # If this is the first payment method or is set as default
    is_default = data.is_default or len(existing_methods) == 0
    
    # If setting as default, unset other defaults
    if is_default:
        for method in existing_methods:
            method["is_default"] = False
    
    payment_method = {
        "payment_method_id": payment_method_id,
        "card_type": data.card_type,
        "last_four": data.last_four,
        "expiry_month": data.expiry_month,
        "expiry_year": data.expiry_year,
        "cardholder_name": data.cardholder_name,
        "is_default": is_default,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Add to existing methods
    existing_methods.append(payment_method)
    
    # Update the user document with the full payment_methods array
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"payment_methods": existing_methods}}
    )
    
    return {"success": True, "payment_method": payment_method}

@api_router.delete("/payment-methods/{payment_method_id}")
async def remove_payment_method(payment_method_id: str, request: Request):
    """Remove a payment method"""
    user = await require_auth(request)
    
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    payment_methods = user_doc.get("payment_methods", [])
    
    # Find the method to remove
    method_to_remove = next((m for m in payment_methods if m["payment_method_id"] == payment_method_id), None)
    if not method_to_remove:
        raise HTTPException(status_code=404, detail="Payment method not found")
    
    # Remove the method
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$pull": {"payment_methods": {"payment_method_id": payment_method_id}}}
    )
    
    # If removed method was default and there are other methods, set first one as default
    if method_to_remove.get("is_default") and len(payment_methods) > 1:
        remaining_methods = [m for m in payment_methods if m["payment_method_id"] != payment_method_id]
        if remaining_methods:
            await db.users.update_one(
                {"user_id": user.user_id, "payment_methods.payment_method_id": remaining_methods[0]["payment_method_id"]},
                {"$set": {"payment_methods.$.is_default": True}}
            )
    
    return {"success": True, "message": "Payment method removed"}

@api_router.put("/payment-methods/{payment_method_id}/default")
async def set_default_payment_method(payment_method_id: str, request: Request):
    """Set a payment method as default"""
    user = await require_auth(request)
    
    # Unset all defaults first
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"payment_methods.$[].is_default": False}}
    )
    
    # Set the new default
    result = await db.users.update_one(
        {"user_id": user.user_id, "payment_methods.payment_method_id": payment_method_id},
        {"$set": {"payment_methods.$.is_default": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Payment method not found")
    
    return {"success": True, "message": "Default payment method updated"}

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
    
    # Get bookings for this student (include all statuses)
    bookings = await db.bookings.find({
        "student_id": student_id
    }, {"_id": 0}).sort("start_at", -1).to_list(100)
    
    # Enrich with tutor info
    enriched = []
    for booking in bookings:
        tutor = await db.tutors.find_one({"tutor_id": booking.get("tutor_id")}, {"_id": 0})
        tutor_user = await db.users.find_one({"user_id": tutor.get("user_id") if tutor else None}, {"_id": 0})
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
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
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
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
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
    """Generate availability rules from weekly schedule"""
    from datetime import date as date_type
    
    start = datetime.strptime(schedule.startDate, "%Y-%m-%d")
    end = datetime.strptime(schedule.endDate, "%Y-%m-%d")
    
    # Remove existing rules for this tutor (from any source)
    await db.availability_rules.delete_many({
        "tutor_id": tutor_id
    })
    
    # Create weekly rules for each enabled day
    for day_schedule in schedule.weeklySchedule:
        if not day_schedule.enabled:
            continue
        
        # Create a single rule for the entire time block
        rule_id = f"rule_{uuid.uuid4().hex[:12]}"
        await db.availability_rules.insert_one({
            "rule_id": rule_id,
            "tutor_id": tutor_id,
            "day_of_week": day_schedule.day,
            "start_time": day_schedule.startTime,
            "end_time": day_schedule.endTime,
            "timezone": "America/New_York",
            "source": "schedule_builder",
            "valid_from": start,
            "valid_until": end,
            "created_at": datetime.now(timezone.utc)
        })

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
        raise HTTPException(status_code=404, detail="Coach profile not found")
    return TutorProfile(**tutor)

@api_router.put("/tutors/profile", response_model=TutorProfile)
async def update_tutor_profile(data: TutorProfileCreate, request: Request):
    user = await require_auth(request)
    result = await db.tutors.update_one(
        {"user_id": user.user_id},
        {"$set": data.dict()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Coach profile not found")
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    return TutorProfile(**tutor)

@api_router.post("/tutors/publish")
async def publish_tutor_profile(request: Request):
    user = await require_auth(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Coach profile not found")
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

# Constants for sponsor rotation
MAX_SPONSORED_PER_SEARCH = 3

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
    consumer_market_id = None
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
    
    # === SPONSOR ROTATION LOGIC ===
    # Get all sponsored tutors matching the query for rotation
    sponsored_query = {**db_query, "is_sponsored": True}
    if category:
        sponsored_query["sponsored_categories"] = category
    
    all_sponsored = await db.tutors.find(sponsored_query, {"_id": 0}).to_list(100)
    
    # Get user's sponsor view history for rotation
    seen_sponsors = []
    if current_user_id:
        user_doc = await db.users.find_one({"user_id": current_user_id}, {"_id": 0})
        seen_sponsors = user_doc.get("seen_sponsors", []) if user_doc else []
    
    # Rotate sponsors: prioritize unseen ones, then cycle back
    unseen_sponsored = [t for t in all_sponsored if t["tutor_id"] not in seen_sponsors]
    seen_sponsored = [t for t in all_sponsored if t["tutor_id"] in seen_sponsors]
    
    # If all have been seen, reset rotation (start fresh but still rotate)
    if len(unseen_sponsored) == 0 and len(all_sponsored) > 0:
        # All sponsors have been seen - reset the tracking
        if current_user_id:
            await db.users.update_one(
                {"user_id": current_user_id},
                {"$set": {"seen_sponsors": []}}
            )
        unseen_sponsored = all_sponsored
        seen_sponsored = []
    
    # Select up to MAX_SPONSORED_PER_SEARCH sponsors (prioritize unseen)
    selected_sponsored = unseen_sponsored[:MAX_SPONSORED_PER_SEARCH]
    if len(selected_sponsored) < MAX_SPONSORED_PER_SEARCH:
        remaining = MAX_SPONSORED_PER_SEARCH - len(selected_sponsored)
        selected_sponsored.extend(seen_sponsored[:remaining])
    
    selected_sponsor_ids = {t["tutor_id"] for t in selected_sponsored}
    
    # Track which sponsors this user has now seen
    if current_user_id and selected_sponsor_ids:
        new_seen = list(set(seen_sponsors) | selected_sponsor_ids)
        await db.users.update_one(
            {"user_id": current_user_id},
            {"$set": {"seen_sponsors": new_seen}}
        )
    
    # Get non-sponsored tutors
    non_sponsored_query = {**db_query}
    non_sponsored_query["$or"] = [
        {"is_sponsored": {"$ne": True}},
        {"is_sponsored": {"$exists": False}}
    ]
    # Also exclude selected sponsors from regular results to avoid duplicates
    if selected_sponsor_ids:
        non_sponsored_query["tutor_id"] = {"$nin": list(selected_sponsor_ids)}
    
    skip = (page - 1) * limit
    # Adjust skip/limit for non-sponsored based on page
    non_sponsored_skip = max(0, skip - len(selected_sponsored)) if page == 1 else skip
    non_sponsored_limit = limit - len(selected_sponsored) if page == 1 else limit
    
    non_sponsored_tutors = await db.tutors.find(non_sponsored_query, {"_id": 0}).sort(
        sort_field, sort_order
    ).skip(non_sponsored_skip).limit(non_sponsored_limit).to_list(non_sponsored_limit)
    
    # Combine: sponsored first (page 1 only), then non-sponsored
    if page == 1:
        all_tutors = selected_sponsored + non_sponsored_tutors
    else:
        all_tutors = non_sponsored_tutors
    
    # Get user info for each tutor
    results = []
    for tutor in all_tutors:
        user = await db.users.find_one({"user_id": tutor["user_id"]}, {"_id": 0})
        if user:
            # Check if sponsored for this specific category
            is_sponsored_display = tutor["tutor_id"] in selected_sponsor_ids
            
            # Include market info in results
            market_info = MARKETS_CONFIG.get(tutor.get("market_id"), {})
            results.append({
                **tutor,
                "user_name": user["name"],
                "user_picture": user.get("picture"),
                "currency": market_info.get("currency", "USD"),
                "currency_symbol": market_info.get("currency_symbol", "$"),
                "is_sponsored": is_sponsored_display
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
        raise HTTPException(status_code=404, detail="Coach not found")
    
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
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
    rules = await db.availability_rules.find({"tutor_id": tutor["tutor_id"]}, {"_id": 0}).to_list(100)
    return rules

@api_router.post("/availability/rules")
async def create_availability_rule(rule: AvailabilityRule, request: Request):
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
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
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
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
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
    result = await db.availability_rules.delete_one({"rule_id": rule_id, "tutor_id": tutor["tutor_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"message": "Rule deleted"}

@api_router.post("/availability/exceptions")
async def create_availability_exception(exc: AvailabilityException, request: Request):
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
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
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
    exceptions = await db.availability_exceptions.find({"tutor_id": tutor["tutor_id"]}, {"_id": 0}).to_list(100)
    return exceptions

# ============== VACATION MANAGEMENT ==============

@api_router.get("/availability/vacations")
async def get_vacations(request: Request):
    """Get tutor's vacation periods"""
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
    vacations = await db.vacations.find({"tutor_id": tutor["tutor_id"]}, {"_id": 0}).to_list(100)
    return vacations

@api_router.post("/availability/vacations")
async def create_vacation(data: VacationPeriodCreate, request: Request):
    """Create a vacation period"""
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
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
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
    result = await db.vacations.delete_one({
        "vacation_id": vacation_id,
        "tutor_id": tutor["tutor_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vacation not found")
    
    return {"success": True, "message": "Vacation deleted"}

@api_router.get("/tutors/{tutor_id}/availability")
async def get_tutor_availability(tutor_id: str, date: str = None, from_date: str = None, to_date: str = None):
    """Get available time slots for a tutor"""
    tutor = await db.tutors.find_one({"tutor_id": tutor_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Coach not found")
    
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
    
    # Generate available slots
    slots = []
    
    # Handle single date parameter (used by frontend)
    if date:
        from_dt = datetime.fromisoformat(date).replace(tzinfo=timezone.utc)
        to_dt = from_dt + timedelta(days=1)
    else:
        from_dt = datetime.fromisoformat(from_date).replace(tzinfo=timezone.utc) if from_date else now
        to_dt = datetime.fromisoformat(to_date).replace(tzinfo=timezone.utc) if to_date else now + timedelta(days=30)
    
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
                    
                    # Check if slot conflicts with existing bookings (compare as naive datetimes)
                    slot_current_naive = slot_current.replace(tzinfo=None)
                    slot_end_naive = slot_end_time.replace(tzinfo=None)
                    now_naive = now.replace(tzinfo=None)
                    
                    is_booked = any(
                        (b["start_at"].replace(tzinfo=None) if hasattr(b["start_at"], 'replace') else b["start_at"]) < slot_end_naive and 
                        (b["end_at"].replace(tzinfo=None) if hasattr(b["end_at"], 'replace') else b["end_at"]) > slot_current_naive
                        for b in bookings
                    )
                    
                    # Check if slot is on hold
                    is_held = any(
                        (h["start_at"].replace(tzinfo=None) if hasattr(h["start_at"], 'replace') else h["start_at"]) < slot_end_naive and 
                        (h["end_at"].replace(tzinfo=None) if hasattr(h["end_at"], 'replace') else h["end_at"]) > slot_current_naive
                        for h in holds
                    )
                    
                    if not is_booked and not is_held and slot_current_naive > now_naive:
                        slots.append({
                            "start_at": slot_current.isoformat(),
                            "end_at": slot_end_time.isoformat(),
                            "start_time": slot_current.strftime("%H:%M"),
                            "end_time": slot_end_time.strftime("%H:%M"),
                            "is_available": True,
                            "available": True
                        })
                    
                    slot_current = slot_end_time
        
        current += timedelta(days=1)
    
    return {"tutor_id": tutor_id, "slots": slots[:100]}  # Limit to 100 slots

# ============== BOOKING ROUTES ==============

@api_router.post("/booking-holds", response_model=BookingHold)
async def create_booking_hold(data: BookingHoldCreate, request: Request):
    logger.info(f"Creating booking hold: tutor_id={data.tutor_id}, start_at={data.start_at}, duration={data.duration_minutes}")
    user = await require_auth(request)
    
    # Check tutor exists
    tutor = await db.tutors.find_one({"tutor_id": data.tutor_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Coach not found")
    
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
        "intake_response": data.intake.model_dump(),
        "payment_id": f"pay_{uuid.uuid4().hex[:12]}",  # Placeholder
        "created_at": datetime.now(timezone.utc)
    }
    await db.bookings.insert_one(booking_doc)
    
    # Remove _id before returning (MongoDB adds it during insert)
    booking_doc.pop("_id", None)
    
    # Delete hold
    await db.booking_holds.delete_one({"hold_id": data.hold_id})
    
    # Start trial if first booking
    if not tutor.get("trial_start_at"):
        await db.tutors.update_one(
            {"tutor_id": hold["tutor_id"]},
            {"$set": {"trial_start_at": datetime.now(timezone.utc)}}
        )
    
    # Send confirmation email to consumer
    try:
        tutor_user = await db.users.find_one({"user_id": tutor["user_id"]}, {"_id": 0})
        consumer_user = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
        
        if consumer_user and tutor_user:
            start_dt = hold["start_at"]
            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=timezone.utc)
            
            email_data = booking_confirmation_email(
                consumer_name=consumer_user["name"],
                coach_name=tutor_user["name"],
                session_date=start_dt.strftime("%B %d, %Y"),
                session_time=start_dt.strftime("%I:%M %p"),
                duration=tutor.get("duration_minutes", 60),
                price=f"{market_config['currency_symbol']}{tutor['base_price']:.2f}",
                meeting_link=tutor.get("meeting_link")  # If coach has set a meeting link
            )
            
            await email_service.send_email(
                to=consumer_user["email"],
                subject=email_data["subject"],
                html=email_data["html"],
                text=email_data["text"]
            )
            logger.info(f"Booking confirmation email sent to {consumer_user['email']}")
    except Exception as e:
        logger.error(f"Failed to send booking confirmation email: {str(e)}")
    
    return booking_doc

@api_router.get("/bookings")
async def get_bookings(request: Request, role: str = "consumer"):
    user = await require_auth(request)
    
    if role == "consumer":
        query = {"consumer_id": user.user_id}
    else:
        tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
        if not tutor:
            raise HTTPException(status_code=404, detail="Coach profile not found")
        query = {"tutor_id": tutor["tutor_id"]}
    
    bookings = await db.bookings.find(query, {"_id": 0}).sort("start_at", -1).to_list(100)
    
    # Enrich with tutor/student info and currency
    results = []
    for b in bookings:
        tutor = await db.tutors.find_one({"tutor_id": b["tutor_id"]}, {"_id": 0})
        tutor_user = await db.users.find_one({"user_id": tutor["user_id"]}, {"_id": 0}) if tutor else None
        student = await db.students.find_one({"student_id": b["student_id"]}, {"_id": 0})
        
        # Get market info for currency
        market_id = b.get("market_id") or (tutor.get("market_id") if tutor else "US_USD") or "US_USD"
        market_config = MARKETS_CONFIG.get(market_id, MARKETS_CONFIG["US_USD"])
        
        results.append({
            **b,
            "tutor_name": tutor_user["name"] if tutor_user else "Unknown",
            "student_name": student["name"] if student else "Unknown",
            "currency": market_config["currency"],
            "currency_symbol": market_config["currency_symbol"]
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
    
    # Enrich with tutor/student info and currency
    booking_tutor = await db.tutors.find_one({"tutor_id": booking["tutor_id"]}, {"_id": 0})
    tutor_user = await db.users.find_one({"user_id": booking_tutor["user_id"]}, {"_id": 0}) if booking_tutor else None
    student = await db.students.find_one({"student_id": booking.get("student_id")}, {"_id": 0})
    
    # Get market info for currency
    market_id = booking.get("market_id") or (booking_tutor.get("market_id") if booking_tutor else "US_USD") or "US_USD"
    market_config = MARKETS_CONFIG.get(market_id, MARKETS_CONFIG["US_USD"])
    
    return {
        **booking,
        "tutor_name": tutor_user["name"] if tutor_user else "Unknown",
        "student_name": student["name"] if student else "Unknown",
        "currency": market_config["currency"],
        "currency_symbol": market_config["currency_symbol"]
    }

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
    
    # Send cancellation emails
    try:
        tutor_info = await db.tutors.find_one({"tutor_id": booking["tutor_id"]}, {"_id": 0})
        tutor_user = await db.users.find_one({"user_id": tutor_info["user_id"]}, {"_id": 0}) if tutor_info else None
        consumer_user = await db.users.find_one({"user_id": booking["consumer_id"]}, {"_id": 0})
        
        if consumer_user and tutor_user:
            start_dt = booking["start_at"]
            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=timezone.utc)
            
            market_config = MARKETS_CONFIG.get(booking.get("market_id", "US_USD"), MARKETS_CONFIG["US_USD"])
            
            # Email to consumer
            consumer_email_data = booking_cancellation_email(
                recipient_name=consumer_user["name"],
                other_party_name=tutor_user["name"],
                session_date=start_dt.strftime("%B %d, %Y"),
                session_time=start_dt.strftime("%I:%M %p"),
                is_consumer=True,
                refund_info=f"Full refund of {market_config['currency_symbol']}{booking['price_snapshot']:.2f} will be processed within 5-7 days"
            )
            await email_service.send_email(
                to=consumer_user["email"],
                subject=consumer_email_data["subject"],
                html=consumer_email_data["html"],
                text=consumer_email_data["text"]
            )
            
            # Email to coach
            coach_email_data = booking_cancellation_email(
                recipient_name=tutor_user["name"],
                other_party_name=consumer_user["name"],
                session_date=start_dt.strftime("%B %d, %Y"),
                session_time=start_dt.strftime("%I:%M %p"),
                is_consumer=False
            )
            await email_service.send_email(
                to=tutor_user["email"],
                subject=coach_email_data["subject"],
                html=coach_email_data["html"],
                text=coach_email_data["text"]
            )
            logger.info(f"Cancellation emails sent for booking {booking_id}")
    except Exception as e:
        logger.error(f"Failed to send cancellation emails: {str(e)}")
    
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

@api_router.post("/bookings/{booking_id}/no-show")
async def mark_booking_no_show(booking_id: str, request: Request, who: str = "consumer"):
    """Mark a booking as no-show (consumer didn't show or coach didn't show)
    
    Args:
        who: 'consumer' if student didn't show, 'coach' if coach didn't show
    """
    user = await require_auth(request)
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Only allow marking as no-show for booked/confirmed bookings
    if booking["status"] not in ["booked", "confirmed"]:
        raise HTTPException(status_code=400, detail="Can only mark active bookings as no-show")
    
    # Check session time has passed
    start_at = booking["start_at"]
    if start_at.tzinfo is None:
        start_at = start_at.replace(tzinfo=timezone.utc)
    
    if start_at > datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Cannot mark as no-show before session time")
    
    # Verify requester has permission
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    is_coach = tutor and tutor["tutor_id"] == booking["tutor_id"]
    is_consumer = booking["consumer_id"] == user.user_id
    
    if not (is_coach or is_consumer):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Determine no-show type and status
    if who == "consumer":
        new_status = "no_show_consumer"
        # Coach reports consumer didn't show - consumer loses payment
        refund_consumer = False
        pay_coach = True
    else:
        new_status = "no_show_coach"
        # Consumer reports coach didn't show - full refund + possible compensation
        refund_consumer = True
        pay_coach = False
    
    # Update booking
    await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {
            "status": new_status,
            "no_show_reported_by": user.user_id,
            "no_show_at": datetime.now(timezone.utc)
        }}
    )
    
    # Get user info for emails
    market_config = MARKETS_CONFIG.get(booking.get("market_id", "US_USD"), MARKETS_CONFIG["US_USD"])
    tutor_info = await db.tutors.find_one({"tutor_id": booking["tutor_id"]}, {"_id": 0})
    tutor_user = await db.users.find_one({"user_id": tutor_info["user_id"]}, {"_id": 0}) if tutor_info else None
    consumer_user = await db.users.find_one({"user_id": booking["consumer_id"]}, {"_id": 0})
    
    # Send no-show notifications
    try:
        if consumer_user and tutor_user:
            if who == "consumer":
                # Email to consumer - they missed
                consumer_email = no_show_notification_email(
                    recipient_name=consumer_user["name"],
                    other_party_name=tutor_user["name"],
                    session_date=start_at.strftime("%B %d, %Y"),
                    session_time=start_at.strftime("%I:%M %p"),
                    is_consumer=True,
                    penalty_info="Payment will be charged as per the no-show policy."
                )
                await email_service.send_email(
                    to=consumer_user["email"],
                    subject=consumer_email["subject"],
                    html=consumer_email["html"],
                    text=consumer_email["text"]
                )
                
                # Email to coach - student didn't show
                coach_email = no_show_notification_email(
                    recipient_name=tutor_user["name"],
                    other_party_name=consumer_user["name"],
                    session_date=start_at.strftime("%B %d, %Y"),
                    session_time=start_at.strftime("%I:%M %p"),
                    is_consumer=False
                )
                await email_service.send_email(
                    to=tutor_user["email"],
                    subject=coach_email["subject"],
                    html=coach_email["html"],
                    text=coach_email["text"]
                )
            else:
                # Coach no-show - refund consumer
                consumer_email = no_show_notification_email(
                    recipient_name=consumer_user["name"],
                    other_party_name=tutor_user["name"],
                    session_date=start_at.strftime("%B %d, %Y"),
                    session_time=start_at.strftime("%I:%M %p"),
                    is_consumer=True,
                    penalty_info=f"Full refund of {market_config['currency_symbol']}{booking['price_snapshot']:.2f} will be processed."
                )
                await email_service.send_email(
                    to=consumer_user["email"],
                    subject=consumer_email["subject"],
                    html=consumer_email["html"],
                    text=consumer_email["text"]
                )
        
        logger.info(f"No-show notifications sent for booking {booking_id}")
    except Exception as e:
        logger.error(f"Failed to send no-show notifications: {str(e)}")
    
    return {
        "message": f"Booking marked as no-show ({who})",
        "status": new_status,
        "refund_consumer": refund_consumer,
        "pay_coach": pay_coach
    }

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
async def get_tutor_reviews_endpoint(tutor_id: str, page: int = 1, limit: int = 20):
    """Get reviews for a coach (combining simple and detailed reviews)"""
    skip = (page - 1) * limit
    
    # Get detailed reviews first (primary source)
    detailed_reviews = await db.detailed_reviews.find(
        {"tutor_id": tutor_id}, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get aggregate stats
    all_detailed = await db.detailed_reviews.find({"tutor_id": tutor_id}, {"_id": 0}).to_list(1000)
    
    if all_detailed:
        avg_teaching = sum(r.get("teaching_quality", 0) for r in all_detailed) / len(all_detailed)
        avg_communication = sum(r.get("communication", 0) for r in all_detailed) / len(all_detailed)
        avg_punctuality = sum(r.get("punctuality", 0) for r in all_detailed) / len(all_detailed)
        avg_knowledge = sum(r.get("knowledge", 0) for r in all_detailed) / len(all_detailed)
        avg_value = sum(r.get("value_for_money", 0) for r in all_detailed) / len(all_detailed)
        recommend_pct = sum(1 for r in all_detailed if r.get("would_recommend", False)) / len(all_detailed) * 100
        
        stats = {
            "total_reviews": len(all_detailed),
            "avg_teaching_quality": round(avg_teaching, 1),
            "avg_communication": round(avg_communication, 1),
            "avg_punctuality": round(avg_punctuality, 1),
            "avg_knowledge": round(avg_knowledge, 1),
            "avg_value_for_money": round(avg_value, 1),
            "recommend_percentage": round(recommend_pct, 0)
        }
    else:
        stats = {"total_reviews": 0}
    
    return {"reviews": detailed_reviews, "stats": stats}

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
        market_info = MARKETS_CONFIG.get(t.get("market_id"), MARKETS_CONFIG.get("US_USD"))
        results.append({
            **t,
            "user_name": user["name"] if user else "Unknown",
            "user_email": user["email"] if user else "Unknown",
            "currency": market_info.get("currency", "USD"),
            "currency_symbol": market_info.get("currency_symbol", "$")
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
        raise HTTPException(status_code=404, detail="Coach not found")
    
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
        raise HTTPException(status_code=404, detail="Coach not found")
    
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
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
    # Get market info
    market_info = MARKETS_CONFIG.get(tutor.get("market_id"), MARKETS_CONFIG.get("US_USD"))
    
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
        "fee_events": fee_events[-10:],  # Last 10 events
        "currency": market_info.get("currency", "USD"),
        "currency_symbol": market_info.get("currency_symbol", "$")
    }

@api_router.get("/billing/fee-events")
async def get_fee_events(request: Request):
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
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
        raise HTTPException(status_code=404, detail="Coach not found")
    
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
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
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
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
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
    
    # NEW: Group by Student with Category/Subject breakdown
    by_student_category = {}
    for b in bookings:
        sid = b.get("student_id")
        if not sid:
            continue
        
        # Get student info
        if sid not in by_student_category:
            student = await db.students.find_one({"student_id": sid}, {"_id": 0})
            by_student_category[sid] = {
                "student_id": sid,
                "student_name": student["name"] if student else "Unknown",
                "total_sessions": 0,
                "total_spent_cents": 0,
                "categories": {}
            }
        
        # Get tutor's category/subject info
        tutor = await db.tutors.find_one({"tutor_id": b["tutor_id"]}, {"_id": 0})
        if tutor:
            categories = tutor.get("categories", ["Uncategorized"])
            subjects = tutor.get("subjects", [])
            
            for cat in categories:
                if cat not in by_student_category[sid]["categories"]:
                    by_student_category[sid]["categories"][cat] = {
                        "category_name": cat,
                        "sessions": 0,
                        "spent_cents": 0,
                        "subjects": {}
                    }
                
                by_student_category[sid]["categories"][cat]["sessions"] += 1
                by_student_category[sid]["categories"][cat]["spent_cents"] += b.get("amount_cents", 0) if b.get("payment_status") == "paid" else 0
                
                # Add subjects
                for subj in subjects:
                    if subj not in by_student_category[sid]["categories"][cat]["subjects"]:
                        by_student_category[sid]["categories"][cat]["subjects"][subj] = {
                            "subject_name": subj,
                            "sessions": 0,
                            "spent_cents": 0
                        }
                    by_student_category[sid]["categories"][cat]["subjects"][subj]["sessions"] += 1
                    by_student_category[sid]["categories"][cat]["subjects"][subj]["spent_cents"] += b.get("amount_cents", 0) if b.get("payment_status") == "paid" else 0
        
        by_student_category[sid]["total_sessions"] += 1
        by_student_category[sid]["total_spent_cents"] += b.get("amount_cents", 0) if b.get("payment_status") == "paid" else 0
    
    # Convert nested dicts to lists
    by_student_category_list = []
    for sid, data in by_student_category.items():
        cat_list = []
        for cat_name, cat_data in data["categories"].items():
            subj_list = list(cat_data["subjects"].values())
            cat_list.append({
                "category_name": cat_name,
                "sessions": cat_data["sessions"],
                "spent_cents": cat_data["spent_cents"],
                "subjects": subj_list
            })
        by_student_category_list.append({
            "student_id": data["student_id"],
            "student_name": data["student_name"],
            "total_sessions": data["total_sessions"],
            "total_spent_cents": data["total_spent_cents"],
            "categories": cat_list
        })
    
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
        "by_student_category": by_student_category_list,
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
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
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
    
    # Get sponsorship data
    sponsorships = await db.sponsorships.find(
        {"tutor_id": tutor["tutor_id"]}, {"_id": 0}
    ).sort("started_at", -1).to_list(100)
    
    total_sponsorship_spent_cents = sum(s.get("price_paid_cents", 0) for s in sponsorships)
    active_sponsorships = [s for s in sponsorships if s.get("status") == "active"]
    
    # Sponsorship summary
    sponsorship_summary = {
        "total_spent_cents": total_sponsorship_spent_cents,
        "active_count": len(active_sponsorships),
        "total_purchases": len(sponsorships),
        "current_active": None
    }
    
    if active_sponsorships:
        active = active_sponsorships[0]
        sponsorship_summary["current_active"] = {
            "plan_name": active.get("plan_name"),
            "weeks": active.get("weeks", 1),
            "expires_at": active.get("expires_at").isoformat() if active.get("expires_at") else None,
            "categories": active.get("categories", [])
        }
    
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
        "sponsorship": sponsorship_summary,
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
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.lib.enums import TA_CENTER
    except ImportError:
        raise HTTPException(status_code=500, detail="PDF generation not available")
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=72)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=24, spaceAfter=10, alignment=TA_CENTER)
    tagline_style = ParagraphStyle('Tagline', parent=styles['Normal'], fontSize=12, spaceAfter=20, alignment=TA_CENTER, textColor=colors.grey)
    heading_style = ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=16, spaceAfter=12)
    subheading_style = ParagraphStyle('SubHeading', parent=styles['Heading3'], fontSize=13, spaceAfter=8, textColor=colors.HexColor('#2563eb'))
    
    story = []
    
    # Logo and Header
    logo_path = os.path.join(os.path.dirname(__file__), 'assets', 'mh_logo_trimmed.png')
    if os.path.exists(logo_path):
        # Logo is 595x793 (vertical), maintain aspect ratio
        logo = Image(logo_path, width=0.75*inch, height=1*inch)
        logo.hAlign = 'CENTER'
        story.append(logo)
    
    story.append(Paragraph("Maestro Hub", title_style))
    story.append(Paragraph("Find your coach, master your skill", tagline_style))
    story.append(Spacer(1, 10))
    
    # Report info
    story.append(Paragraph(f"<b>Session Report</b> for {user.name}", styles['Normal']))
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
    
    # By Student with Category Grouping
    if report.get("by_student_category"):
        story.append(Paragraph("Sessions by Student & Category", heading_style))
        for student_group in report["by_student_category"]:
            # Student header
            story.append(Paragraph(f"{student_group['student_name']}", subheading_style))
            
            student_data = [["Category", "Subject", "Sessions", "Amount"]]
            for cat in student_group.get("categories", []):
                for subj in cat.get("subjects", []):
                    student_data.append([
                        cat["category_name"],
                        subj["subject_name"],
                        str(subj["sessions"]),
                        f"{symbol}{subj['spent_cents']/100:.2f}"
                    ])
                if not cat.get("subjects"):
                    student_data.append([cat["category_name"], "-", str(cat["sessions"]), f"{symbol}{cat['spent_cents']/100:.2f}"])
            
            # Add student total row
            student_data.append(["", "TOTAL", str(student_group["total_sessions"]), f"{symbol}{student_group['total_spent_cents']/100:.2f}"])
            
            student_table = Table(student_data, colWidths=[1.8*inch, 1.8*inch, 1*inch, 1.2*inch])
            student_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563eb')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f0f4ff')),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                ('GRID', (0, 0), (-1, -1), 1, colors.grey),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('PADDING', (0, 0), (-1, -1), 5),
            ]))
            story.append(student_table)
            story.append(Spacer(1, 12))
    elif report["by_student"]:
        # Fallback to simple student list
        story.append(Paragraph("Sessions by Student", heading_style))
        student_data = [["Student", "Sessions", "Amount"]]
        for s in report["by_student"]:
            student_data.append([s["student_name"], str(s["sessions"]), f"{symbol}{s['spent_cents']/100:.2f}"])
        
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
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.lib.enums import TA_CENTER
    except ImportError:
        raise HTTPException(status_code=500, detail="PDF generation not available")
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=72)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=24, spaceAfter=10, alignment=TA_CENTER)
    tagline_style = ParagraphStyle('Tagline', parent=styles['Normal'], fontSize=12, spaceAfter=20, alignment=TA_CENTER, textColor=colors.grey)
    heading_style = ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=16, spaceAfter=12)
    subheading_style = ParagraphStyle('SubHeading', parent=styles['Heading3'], fontSize=13, spaceAfter=8, textColor=colors.HexColor('#2563eb'))
    
    story = []
    
    # Logo and Header
    logo_path = os.path.join(os.path.dirname(__file__), 'assets', 'mh_logo_trimmed.png')
    if os.path.exists(logo_path):
        # Logo is 595x793 (vertical), maintain aspect ratio
        logo = Image(logo_path, width=0.75*inch, height=1*inch)
        logo.hAlign = 'CENTER'
        story.append(logo)
    
    story.append(Paragraph("Maestro Hub", title_style))
    story.append(Paragraph("Find your coach, master your skill", tagline_style))
    story.append(Spacer(1, 10))
    
    # Report info
    story.append(Paragraph(f"<b>Earnings Report</b> for {user.name}", styles['Normal']))
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
    
    # By Student with Category Grouping (if available)
    if report.get("by_student_category"):
        story.append(Paragraph("Sessions by Student & Category", heading_style))
        for student_group in report["by_student_category"]:
            # Student header
            story.append(Paragraph(f"{student_group['student_name']}", subheading_style))
            
            student_data = [["Category", "Subject", "Sessions", "Earned"]]
            for cat in student_group.get("categories", []):
                for subj in cat.get("subjects", []):
                    student_data.append([
                        cat["category_name"],
                        subj["subject_name"],
                        str(subj["sessions"]),
                        f"{symbol}{subj['earned_cents']/100:.2f}"
                    ])
                if not cat.get("subjects"):
                    student_data.append([cat["category_name"], "-", str(cat["sessions"]), f"{symbol}{cat['earned_cents']/100:.2f}"])
            
            # Add student total row
            student_data.append(["", "TOTAL", str(student_group["total_sessions"]), f"{symbol}{student_group['total_earned_cents']/100:.2f}"])
            
            student_table = Table(student_data, colWidths=[1.8*inch, 1.8*inch, 1*inch, 1.2*inch])
            student_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563eb')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f0f4ff')),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                ('GRID', (0, 0), (-1, -1), 1, colors.grey),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('PADDING', (0, 0), (-1, -1), 5),
            ]))
            story.append(student_table)
            story.append(Spacer(1, 12))
    elif report["by_student"]:
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
            # 1. Academics
            {"id": "academics", "name": "Academics", "subjects": [
                "Homework Support", "Mathematics", "Advanced Mathematics", "Science", 
                "Coding/Programming", "Languages & Writing", "Social Studies & Humanities", 
                "Test Prep", "Study & Academic Skills"
            ]},
            # 2. Performance & Creative Arts
            {"id": "performance_arts", "name": "Performance & Creative Arts", "subjects": [
                "Performance Coaching", "Sports", "Music", "Acting", "Voice", "Dance", 
                "Stage Presence & Theatre", "Piano", "Guitar", "Violin", "Drums", "Music Theory"
            ]},
            # 3. Activities & Hobbies
            {"id": "activities_hobbies", "name": "Activities & Hobbies", "subjects": [
                "Art & Design", "Yoga", "STEM & Interest Clubs", "Debates", "Photography", 
                "Cooking & Baking", "Games", "Memory Training"
            ]},
            # 4. Fitness & Nutrition
            {"id": "fitness_nutrition", "name": "Fitness & Nutrition", "subjects": [
                "Fitness Training", "Nutrition Coaching", "Weight Loss", "Recovery Coaching"
            ]},
            # 5. Health, Mindfulness & Wellbeing
            {"id": "health_mindfulness", "name": "Health, Mindfulness & Wellbeing", "subjects": [
                "Health Coaching", "Wellness Coaching", "Mindfulness", "Meditation", 
                "Spiritual Coaching", "Stress Management", "Mindset Coaching"
            ]},
            # 6. Business, Communication & Growth
            {"id": "business_communication", "name": "Business, Communication & Growth", "subjects": [
                "Sales Coaching", "Marketing Coaching", "Branding", "Communication Coaching", 
                "Productivity Coaching", "Business Strategy", "Image Consulting", "Personal Style"
            ]},
            # 7. Finance, Legal & Negotiation
            {"id": "finance_legal", "name": "Finance, Legal & Negotiation", "subjects": [
                "Financial Planning", "Investment Coaching", "Retirement Planning", 
                "Real Estate Coaching", "Legal Coaching", "Negotiation Coaching"
            ]},
            # 8. Coaching & Personal Growth
            {"id": "coaching_personal", "name": "Coaching & Personal Growth", "subjects": [
                "Life Coaching", "Executive Coaching", "Career Coaching", "Leadership Coaching", 
                "Agile Coaching", "Personal Development", "Confidence Coaching", 
                "Transformational Coaching", "Motivational Coaching", "Public Speaking"
            ]},
            # 9. Relationships & Family
            {"id": "relationships_family", "name": "Relationships & Family", "subjects": [
                "Relationship Coaching", "Marriage Coaching", "Parenting Coaching", 
                "Fertility Coaching", "Divorce Coaching", "Grief Coaching"
            ]},
            # 10. Culture, Inclusion & Experiences
            {"id": "culture_inclusion", "name": "Culture, Inclusion & Experiences", "subjects": [
                "Diversity & Inclusion", "Team-Building", "Travel Coaching"
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
        raise HTTPException(status_code=404, detail="Coach profile not found. Create a profile first.")
    
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
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
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
        raise HTTPException(status_code=404, detail="Coach not found")
    
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
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
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
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
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
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
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


# ============== SESSION PACKAGES ==============

@api_router.get("/tutors/{tutor_id}/packages")
async def get_tutor_packages(tutor_id: str):
    """Get session packages offered by a coach"""
    tutor = await db.tutors.find_one({"tutor_id": tutor_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Coach not found")
    
    packages = await db.session_packages.find(
        {"tutor_id": tutor_id, "is_active": True},
        {"_id": 0}
    ).to_list(20)
    
    # Get market info for currency
    market_config = MARKETS_CONFIG.get(tutor.get("market_id", "US_USD"), MARKETS_CONFIG["US_USD"])
    
    return {
        "packages": packages,
        "base_price": tutor.get("base_price", 0),
        "currency": market_config["currency"],
        "currency_symbol": market_config["currency_symbol"]
    }

@api_router.post("/tutor/packages")
async def create_session_package(data: SessionPackageCreate, request: Request):
    """Create a new session package (coach only)"""
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    
    if not tutor:
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
    # Enforce flat 5% discount for 12+ sessions (bulk discount rule)
    discount_percent = data.discount_percent
    if data.session_count >= 12:
        discount_percent = 5.0  # Flat 5% for bulk orders
    
    # Calculate pricing
    base_price = tutor.get("base_price", 0)
    discounted_price = base_price * (1 - discount_percent / 100)
    total_price = round(discounted_price * data.session_count, 2)
    
    package = {
        "package_id": f"pkg_{uuid.uuid4().hex[:12]}",
        "tutor_id": tutor["tutor_id"],
        "name": data.name,
        "session_count": data.session_count,
        "price_per_session": round(discounted_price, 2),
        "total_price": total_price,
        "discount_percent": discount_percent,
        "validity_days": data.validity_days,
        "description": data.description,
        "is_active": True,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.session_packages.insert_one(package)
    
    # Remove _id before returning (MongoDB adds it during insert)
    package.pop("_id", None)
    
    return {"success": True, "package": package, "bulk_discount_applied": data.session_count >= 12}

@api_router.get("/tutor/packages")
async def get_my_packages(request: Request):
    """Get packages for current coach"""
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    
    if not tutor:
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
    packages = await db.session_packages.find(
        {"tutor_id": tutor["tutor_id"]},
        {"_id": 0}
    ).to_list(50)
    
    return {"packages": packages}

@api_router.put("/tutor/packages/{package_id}")
async def update_package(package_id: str, request: Request):
    """Toggle package active status"""
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    
    package = await db.session_packages.find_one({"package_id": package_id}, {"_id": 0})
    if not package or package["tutor_id"] != tutor["tutor_id"]:
        raise HTTPException(status_code=404, detail="Package not found")
    
    new_status = not package.get("is_active", True)
    await db.session_packages.update_one(
        {"package_id": package_id},
        {"$set": {"is_active": new_status}}
    )
    
    return {"success": True, "is_active": new_status}

@api_router.delete("/tutor/packages/{package_id}")
async def delete_package(package_id: str, request: Request):
    """Delete a session package"""
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    
    package = await db.session_packages.find_one({"package_id": package_id}, {"_id": 0})
    if not package or package["tutor_id"] != tutor["tutor_id"]:
        raise HTTPException(status_code=404, detail="Package not found")
    
    await db.session_packages.delete_one({"package_id": package_id})
    
    return {"success": True}

@api_router.post("/packages/{package_id}/purchase")
async def purchase_package(package_id: str, request: Request, student_id: str = None):
    """Purchase a session package"""
    user = await require_auth(request)
    
    package = await db.session_packages.find_one({"package_id": package_id, "is_active": True}, {"_id": 0})
    if not package:
        raise HTTPException(status_code=404, detail="Package not found or inactive")
    
    tutor = await db.tutors.find_one({"tutor_id": package["tutor_id"]}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Coach not found")
    
    # Get student
    if student_id:
        student = await db.students.find_one({"student_id": student_id, "user_id": user.user_id}, {"_id": 0})
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
    else:
        # Use first student
        student = await db.students.find_one({"user_id": user.user_id}, {"_id": 0})
        if not student:
            raise HTTPException(status_code=400, detail="Please add a student first")
    
    # Get market info
    market_config = MARKETS_CONFIG.get(tutor.get("market_id", "US_USD"), MARKETS_CONFIG["US_USD"])
    
    # Check payment methods
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    linked_providers = user_doc.get("payment_providers", [])
    
    if not linked_providers:
        return {
            "success": False,
            "error": "no_payment_method",
            "message": "Please add a payment method first",
            "redirect_to_billing": True
        }
    
    # Process payment (simulated)
    amount_cents = int(package["total_price"] * 100)
    platform_fee = int(amount_cents * PLATFORM_FEE_PERCENT / 100)
    tutor_payout = amount_cents - platform_fee
    
    payment_id = f"pay_{uuid.uuid4().hex[:12]}"
    
    # Create purchase record
    purchase = {
        "purchase_id": f"pur_{uuid.uuid4().hex[:12]}",
        "package_id": package_id,
        "tutor_id": package["tutor_id"],
        "consumer_id": user.user_id,
        "student_id": student["student_id"],
        "package_name": package["name"],
        "total_sessions": package["session_count"],
        "sessions_used": 0,
        "sessions_remaining": package["session_count"],
        "price_paid": package["total_price"],
        "currency": market_config["currency"],
        "currency_symbol": market_config["currency_symbol"],
        "purchased_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=package["validity_days"]),
        "status": "active",
        "payment_id": payment_id
    }
    
    await db.purchased_packages.insert_one(purchase)
    
    # Record payment
    payment_record = {
        "payment_id": payment_id,
        "purchase_id": purchase["purchase_id"],
        "tutor_id": package["tutor_id"],
        "consumer_id": user.user_id,
        "amount_cents": amount_cents,
        "currency": market_config["currency"],
        "platform_fee_cents": platform_fee,
        "tutor_payout_cents": tutor_payout,
        "type": "package_purchase",
        "status": "completed",
        "processed_at": datetime.now(timezone.utc)
    }
    await db.payments.insert_one(payment_record)
    
    return {
        "success": True,
        "purchase": purchase,
        "payment_id": payment_id
    }

@api_router.get("/my-packages")
async def get_my_purchased_packages(request: Request):
    """Get consumer's purchased packages"""
    user = await require_auth(request)
    
    packages = await db.purchased_packages.find(
        {"consumer_id": user.user_id},
        {"_id": 0}
    ).sort("purchased_at", -1).to_list(50)
    
    # Update expired packages
    now = datetime.now(timezone.utc)
    for pkg in packages:
        if pkg["status"] == "active":
            expires_at = pkg["expires_at"]
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if now > expires_at:
                pkg["status"] = "expired"
                await db.purchased_packages.update_one(
                    {"purchase_id": pkg["purchase_id"]},
                    {"$set": {"status": "expired"}}
                )
    
    return {"packages": packages}

@api_router.post("/bookings/use-package")
async def book_with_package(request: Request):
    """Create a booking using a purchased package"""
    user = await require_auth(request)
    body = await request.json()
    
    purchase_id = body.get("purchase_id")
    start_at = body.get("start_at")
    student_id = body.get("student_id")
    
    # Get purchase
    purchase = await db.purchased_packages.find_one(
        {"purchase_id": purchase_id, "consumer_id": user.user_id, "status": "active"},
        {"_id": 0}
    )
    
    if not purchase:
        raise HTTPException(status_code=404, detail="Active package not found")
    
    if purchase["sessions_remaining"] <= 0:
        raise HTTPException(status_code=400, detail="No sessions remaining in this package")
    
    # Check expiry
    expires_at = purchase["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires_at:
        await db.purchased_packages.update_one(
            {"purchase_id": purchase_id},
            {"$set": {"status": "expired"}}
        )
        raise HTTPException(status_code=400, detail="Package has expired")
    
    # Get tutor
    tutor = await db.tutors.find_one({"tutor_id": purchase["tutor_id"]}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Coach not found")
    
    tutor_user = await db.users.find_one({"user_id": tutor["user_id"]}, {"_id": 0})
    
    # Parse start time
    if isinstance(start_at, str):
        start_at = datetime.fromisoformat(start_at.replace('Z', '+00:00'))
    if start_at.tzinfo is None:
        start_at = start_at.replace(tzinfo=timezone.utc)
    
    duration = tutor.get("duration_minutes", 60)
    end_at = start_at + timedelta(minutes=duration)
    
    # Calculate per-session price
    price_per_session = purchase["price_paid"] / purchase["total_sessions"]
    
    # Create booking
    booking_id = f"booking_{uuid.uuid4().hex[:12]}"
    market_config = MARKETS_CONFIG.get(tutor.get("market_id", "US_USD"), MARKETS_CONFIG["US_USD"])
    
    booking = {
        "booking_id": booking_id,
        "tutor_id": tutor["tutor_id"],
        "consumer_id": user.user_id,
        "student_id": student_id or purchase["student_id"],
        "start_at": start_at,
        "end_at": end_at,
        "status": "booked",
        "price_snapshot": round(price_per_session, 2),
        "amount_cents": int(price_per_session * 100),
        "market_id": tutor.get("market_id", "US_USD"),
        "policy_snapshot": tutor.get("policies", {}),
        "payment_status": "paid",
        "package_purchase_id": purchase_id,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.bookings.insert_one(booking)
    
    # Update package usage
    new_remaining = purchase["sessions_remaining"] - 1
    new_status = "completed" if new_remaining == 0 else "active"
    
    await db.purchased_packages.update_one(
        {"purchase_id": purchase_id},
        {
            "$set": {
                "sessions_used": purchase["sessions_used"] + 1,
                "sessions_remaining": new_remaining,
                "status": new_status
            }
        }
    )
    
    return {
        "success": True,
        "booking": booking,
        "sessions_remaining": new_remaining
    }


# ============== DETAILED REVIEWS ==============

@api_router.post("/reviews")
async def create_detailed_review(data: DetailedReviewCreate, request: Request):
    """Create a detailed review for a coach"""
    user = await require_auth(request)
    
    # Check if tutor exists
    tutor = await db.tutors.find_one({"tutor_id": data.tutor_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Coach not found")
    
    # Check if user has had a session with this tutor
    has_booking = await db.bookings.find_one({
        "consumer_id": user.user_id,
        "tutor_id": data.tutor_id,
        "status": {"$in": ["completed", "booked", "confirmed"]}
    })
    
    if not has_booking:
        raise HTTPException(status_code=400, detail="You can only review coaches you've had sessions with")
    
    # Check if already reviewed this tutor recently
    existing_review = await db.detailed_reviews.find_one({
        "consumer_id": user.user_id,
        "tutor_id": data.tutor_id,
        "created_at": {"$gte": datetime.now(timezone.utc) - timedelta(days=30)}
    })
    
    if existing_review:
        raise HTTPException(status_code=400, detail="You've already reviewed this coach recently")
    
    # Calculate overall rating
    overall = (data.teaching_quality + data.communication + data.punctuality + 
               data.knowledge + data.value_for_money) / 5
    
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    
    review = {
        "review_id": f"rev_{uuid.uuid4().hex[:12]}",
        "booking_id": data.booking_id,
        "tutor_id": data.tutor_id,
        "consumer_id": user.user_id,
        "consumer_name": user_doc.get("name", "Anonymous"),
        "teaching_quality": data.teaching_quality,
        "communication": data.communication,
        "punctuality": data.punctuality,
        "knowledge": data.knowledge,
        "value_for_money": data.value_for_money,
        "overall_rating": round(overall, 1),
        "comment": data.comment,
        "would_recommend": data.would_recommend,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.detailed_reviews.insert_one(review)
    
    # Remove _id before returning
    review.pop("_id", None)
    
    # Update tutor's average rating
    all_reviews = await db.detailed_reviews.find({"tutor_id": data.tutor_id}, {"_id": 0}).to_list(1000)
    avg_rating = sum(r["overall_rating"] for r in all_reviews) / len(all_reviews)
    
    await db.tutors.update_one(
        {"tutor_id": data.tutor_id},
        {"$set": {"rating_avg": round(avg_rating, 1), "rating_count": len(all_reviews)}}
    )
    
    return {"success": True, "review": review}

@api_router.get("/reviews/my-reviews")
async def get_my_reviews(request: Request):
    """Get reviews written by current user"""
    user = await require_auth(request)
    
    reviews = await db.detailed_reviews.find(
        {"consumer_id": user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Enrich with tutor info
    for review in reviews:
        tutor = await db.tutors.find_one({"tutor_id": review["tutor_id"]}, {"_id": 0})
        tutor_user = await db.users.find_one({"user_id": tutor["user_id"]}, {"_id": 0}) if tutor else None
        review["tutor_name"] = tutor_user.get("name") if tutor_user else "Unknown"
    
    return {"reviews": reviews}

@api_router.get("/reviews/pending")
async def get_pending_reviews(request: Request):
    """Get coaches that can be reviewed (had sessions but not reviewed recently)"""
    user = await require_auth(request)
    
    # Get completed bookings
    bookings = await db.bookings.find({
        "consumer_id": user.user_id,
        "status": "completed"
    }, {"_id": 0}).to_list(100)
    
    tutor_ids = list(set(b["tutor_id"] for b in bookings))
    
    # Get recent reviews
    recent_reviews = await db.detailed_reviews.find({
        "consumer_id": user.user_id,
        "created_at": {"$gte": datetime.now(timezone.utc) - timedelta(days=30)}
    }, {"_id": 0}).to_list(100)
    
    reviewed_tutor_ids = set(r["tutor_id"] for r in recent_reviews)
    
    # Get tutors not reviewed recently
    pending = []
    for tutor_id in tutor_ids:
        if tutor_id not in reviewed_tutor_ids:
            tutor = await db.tutors.find_one({"tutor_id": tutor_id}, {"_id": 0})
            if tutor:
                tutor_user = await db.users.find_one({"user_id": tutor["user_id"]}, {"_id": 0})
                pending.append({
                    "tutor_id": tutor_id,
                    "tutor_name": tutor_user.get("name") if tutor_user else "Unknown",
                    "subjects": tutor.get("subjects", [])
                })
    
    return {"pending_reviews": pending}


# ============== COACH RESPONSE TO REVIEWS ==============

@api_router.post("/reviews/{review_id}/respond")
async def respond_to_review(review_id: str, data: CoachResponseCreate, request: Request):
    """Coach responds to a review"""
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    
    if not tutor:
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
    # Get the review
    review = await db.detailed_reviews.find_one({"review_id": review_id}, {"_id": 0})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    # Verify review is for this coach
    if review["tutor_id"] != tutor["tutor_id"]:
        raise HTTPException(status_code=403, detail="You can only respond to your own reviews")
    
    # Check if already responded
    if review.get("coach_response"):
        raise HTTPException(status_code=400, detail="You have already responded to this review")
    
    # Add response
    await db.detailed_reviews.update_one(
        {"review_id": review_id},
        {
            "$set": {
                "coach_response": data.response,
                "coach_response_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {"success": True, "message": "Response added successfully"}

@api_router.get("/tutor/reviews")
async def get_my_reviews_as_coach(request: Request):
    """Get all reviews for current coach"""
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    
    if not tutor:
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
    reviews = await db.detailed_reviews.find(
        {"tutor_id": tutor["tutor_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"reviews": reviews}


# ============== SPONSORSHIP/ADVERTISING ==============

@api_router.get("/sponsorship/plans")
async def get_sponsorship_plans(request: Request):
    """Get available sponsorship plans for current coach's market"""
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    
    if not tutor:
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
    market_id = tutor.get("market_id", "US_USD")
    
    if market_id == "IN_INR":
        plans = SPONSORSHIP_PLANS_INR
        currency_symbol = "₹"
    else:
        plans = SPONSORSHIP_PLANS
        currency_symbol = "$"
    
    return {
        "plans": plans,
        "currency_symbol": currency_symbol,
        "platform_fee_percent": 0  # Fee is built into the price
    }

@api_router.get("/sponsorship/my-sponsorships")
async def get_my_sponsorships(request: Request):
    """Get coach's active and past sponsorships"""
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    
    if not tutor:
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
    sponsorships = await db.sponsorships.find(
        {"tutor_id": tutor["tutor_id"]},
        {"_id": 0}
    ).sort("started_at", -1).to_list(50)
    
    # Update expired sponsorships
    now = datetime.now(timezone.utc)
    for s in sponsorships:
        if s["status"] == "active":
            expires_at = s["expires_at"]
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if now > expires_at:
                s["status"] = "expired"
                await db.sponsorships.update_one(
                    {"sponsorship_id": s["sponsorship_id"]},
                    {"$set": {"status": "expired"}}
                )
    
    active = [s for s in sponsorships if s["status"] == "active"]
    past = [s for s in sponsorships if s["status"] != "active"]
    
    return {"active": active, "past": past}

@api_router.post("/sponsorship/purchase")
async def purchase_sponsorship(data: SponsorshipCreate, request: Request):
    """Purchase a sponsorship plan"""
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    
    if not tutor:
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
    market_id = tutor.get("market_id", "US_USD")
    plans = SPONSORSHIP_PLANS_INR if market_id == "IN_INR" else SPONSORSHIP_PLANS
    
    # Find the plan
    plan = next((p for p in plans if p["plan_id"] == data.plan_id), None)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Check payment methods
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    linked_providers = user_doc.get("payment_providers", [])
    
    if not linked_providers:
        return {
            "success": False,
            "error": "no_payment_method",
            "message": "Please add a payment method first",
            "redirect_to_billing": True
        }
    
    # Pricing is flat - no additional platform fee shown to user
    # Fee is already built into the weekly rates ($15/week, $10/week for 12+ weeks)
    price_cents = plan["price_cents"]
    total_charge = price_cents  # No extra fee
    
    # Process payment (simulated)
    payment_id = f"pay_{uuid.uuid4().hex[:12]}"
    
    # Record payment
    payment_record = {
        "payment_id": payment_id,
        "tutor_id": tutor["tutor_id"],
        "amount_cents": total_charge,
        "base_amount_cents": price_cents,
        "platform_fee_cents": 0,  # Fee built into price
        "currency": plan["currency"],
        "type": "sponsorship",
        "plan_id": data.plan_id,
        "weeks": plan.get("weeks", 1),
        "status": "completed",
        "processed_at": datetime.now(timezone.utc)
    }
    await db.payments.insert_one(payment_record)
    
    # Create sponsorship
    now = datetime.now(timezone.utc)
    sponsorship = {
        "sponsorship_id": f"spon_{uuid.uuid4().hex[:12]}",
        "tutor_id": tutor["tutor_id"],
        "plan_id": plan["plan_id"],
        "plan_name": plan["name"],
        "weeks": plan.get("weeks", 1),
        "categories": data.categories,
        "price_paid_cents": price_cents,
        "platform_fee_cents": 0,
        "currency": plan["currency"],
        "started_at": now,
        "expires_at": now + timedelta(days=plan["duration_days"]),
        "auto_renew": data.auto_renew,
        "status": "active",
        "payment_id": payment_id
    }
    
    await db.sponsorships.insert_one(sponsorship)
    
    # Update tutor as sponsored
    await db.tutors.update_one(
        {"tutor_id": tutor["tutor_id"]},
        {"$set": {"is_sponsored": True, "sponsored_categories": data.categories}}
    )
    
    market_config = MARKETS_CONFIG.get(market_id, MARKETS_CONFIG["US_USD"])
    
    return {
        "success": True,
        "sponsorship": sponsorship,
        "payment_id": payment_id,
        "total_charged": f"{market_config['currency_symbol']}{total_charge/100:.2f}",
    }

@api_router.post("/sponsorship/{sponsorship_id}/renew")
async def renew_sponsorship(sponsorship_id: str, request: Request):
    """Manually renew a sponsorship"""
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    
    if not tutor:
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
    sponsorship = await db.sponsorships.find_one(
        {"sponsorship_id": sponsorship_id, "tutor_id": tutor["tutor_id"]},
        {"_id": 0}
    )
    
    if not sponsorship:
        raise HTTPException(status_code=404, detail="Sponsorship not found")
    
    # Get the plan
    market_id = tutor.get("market_id", "US_USD")
    plans = SPONSORSHIP_PLANS_INR if market_id == "IN_INR" else SPONSORSHIP_PLANS
    plan = next((p for p in plans if p["plan_id"] == sponsorship["plan_id"]), None)
    
    if not plan:
        raise HTTPException(status_code=404, detail="Original plan no longer available")
    
    # Check payment methods
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    linked_providers = user_doc.get("payment_providers", [])
    
    if not linked_providers:
        return {
            "success": False,
            "error": "no_payment_method",
            "message": "Please add a payment method first"
        }
    
    # Calculate fees
    price_cents = plan["price_cents"]
    platform_fee_cents = int(price_cents * 0.05)
    total_charge = price_cents + platform_fee_cents
    
    # Process payment
    payment_id = f"pay_{uuid.uuid4().hex[:12]}"
    
    payment_record = {
        "payment_id": payment_id,
        "tutor_id": tutor["tutor_id"],
        "amount_cents": total_charge,
        "base_amount_cents": price_cents,
        "platform_fee_cents": platform_fee_cents,
        "currency": plan["currency"],
        "type": "sponsorship_renewal",
        "sponsorship_id": sponsorship_id,
        "status": "completed",
        "processed_at": datetime.now(timezone.utc)
    }
    await db.payments.insert_one(payment_record)
    
    # Extend sponsorship
    now = datetime.now(timezone.utc)
    current_expiry = sponsorship["expires_at"]
    if isinstance(current_expiry, str):
        current_expiry = datetime.fromisoformat(current_expiry.replace('Z', '+00:00'))
    if current_expiry.tzinfo is None:
        current_expiry = current_expiry.replace(tzinfo=timezone.utc)
    
    # If expired, start from now; otherwise extend from current expiry
    new_start = max(now, current_expiry)
    new_expiry = new_start + timedelta(days=plan["duration_days"])
    
    await db.sponsorships.update_one(
        {"sponsorship_id": sponsorship_id},
        {
            "$set": {
                "expires_at": new_expiry,
                "status": "active"
            }
        }
    )
    
    market_config = MARKETS_CONFIG.get(market_id, MARKETS_CONFIG["US_USD"])
    
    return {
        "success": True,
        "new_expiry": new_expiry.isoformat(),
        "total_charged": f"{market_config['currency_symbol']}{total_charge/100:.2f}"
    }

@api_router.put("/sponsorship/{sponsorship_id}/auto-renew")
async def toggle_auto_renew(sponsorship_id: str, request: Request):
    """Toggle auto-renew for a sponsorship"""
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    
    if not tutor:
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
    sponsorship = await db.sponsorships.find_one(
        {"sponsorship_id": sponsorship_id, "tutor_id": tutor["tutor_id"]},
        {"_id": 0}
    )
    
    if not sponsorship:
        raise HTTPException(status_code=404, detail="Sponsorship not found")
    
    new_auto_renew = not sponsorship.get("auto_renew", False)
    
    await db.sponsorships.update_one(
        {"sponsorship_id": sponsorship_id},
        {"$set": {"auto_renew": new_auto_renew}}
    )
    
    return {"success": True, "auto_renew": new_auto_renew}

@api_router.post("/sponsorship/{sponsorship_id}/cancel")
async def cancel_sponsorship(sponsorship_id: str, request: Request):
    """Cancel a sponsorship (stops auto-renew, lets current period expire)"""
    user = await require_tutor(request)
    tutor = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    
    if not tutor:
        raise HTTPException(status_code=404, detail="Coach profile not found")
    
    sponsorship = await db.sponsorships.find_one(
        {"sponsorship_id": sponsorship_id, "tutor_id": tutor["tutor_id"]},
        {"_id": 0}
    )
    
    if not sponsorship:
        raise HTTPException(status_code=404, detail="Sponsorship not found")
    
    await db.sponsorships.update_one(
        {"sponsorship_id": sponsorship_id},
        {"$set": {"auto_renew": False, "status": "cancelled"}}
    )
    
    # Check if this was the only active sponsorship
    active_count = await db.sponsorships.count_documents({
        "tutor_id": tutor["tutor_id"],
        "status": "active"
    })
    
    if active_count == 0:
        await db.tutors.update_one(
            {"tutor_id": tutor["tutor_id"]},
            {"$set": {"is_sponsored": False, "sponsored_categories": []}}
        )
    
    return {"success": True, "message": "Sponsorship cancelled. Your current period will remain active until expiry."}


# Update tutor search to show sponsored coaches first
@api_router.get("/tutors/search/sponsored")
async def get_sponsored_tutors(category: Optional[str] = None):
    """Get sponsored coaches for a category"""
    query = {"is_sponsored": True, "status": "approved", "is_published": True}
    
    if category:
        query["$or"] = [
            {"sponsored_categories": category},
            {"categories": category}
        ]
    
    sponsored = await db.tutors.find(query, {"_id": 0}).to_list(10)
    
    # Enrich with user info
    results = []
    for tutor in sponsored:
        user = await db.users.find_one({"user_id": tutor["user_id"]}, {"_id": 0})
        market_config = MARKETS_CONFIG.get(tutor.get("market_id", "US_USD"), MARKETS_CONFIG["US_USD"])
        results.append({
            **tutor,
            "user_name": user["name"] if user else "Unknown",
            "currency_symbol": market_config["currency_symbol"],
            "is_sponsored": True
        })
    
    return {"sponsored_tutors": results}


# Include router
app.include_router(api_router)

# Dynamic CORS allowing specific origins with credentials
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:8001",
    "https://mentor-match-82.preview.emergentagent.com",
    "https://mentor-match-82.preview.emergentagent.com",
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
