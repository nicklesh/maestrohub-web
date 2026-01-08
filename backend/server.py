from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query
from fastapi.security import HTTPBearer
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'acharyaly')]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'acharyaly-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_DAYS = 7

# Stripe Config (placeholder)
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', 'sk_test_placeholder')
STRIPE_PUBLISHABLE_KEY = os.environ.get('STRIPE_PUBLISHABLE_KEY', 'pk_test_placeholder')

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
app = FastAPI(title="Acharyaly API", version="1.0.0")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============== MODELS ==============

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
    devices: List[DeviceInfo] = []
    created_at: datetime

class StudentCreate(BaseModel):
    name: str
    age: Optional[int] = None
    grade: Optional[str] = None
    notes: Optional[str] = None

class Student(StudentCreate):
    student_id: str
    user_id: str
    created_at: datetime

class TutorPolicies(BaseModel):
    cancel_window_hours: int = 24
    no_show_policy: str = "Full charge for no-shows"
    late_arrival_policy: str = "Lesson time not extended"

class TutorProfileCreate(BaseModel):
    bio: str
    categories: List[str]  # academic, music, activities
    subjects: List[str]
    levels: List[str]  # elementary, middle_school, high_school, college, adult
    modality: List[str]  # online, in_person
    service_area_radius: Optional[int] = 10  # miles
    base_price: float
    duration_minutes: int = 60
    policies: TutorPolicies = TutorPolicies()

class TutorProfile(TutorProfileCreate):
    tutor_id: str
    user_id: str
    status: str = "pending"  # pending, approved, suspended
    is_published: bool = False
    trial_start_at: Optional[datetime] = None
    rating_avg: float = 0.0
    rating_count: int = 0
    created_at: datetime

class AvailabilityRule(BaseModel):
    rule_id: str = Field(default_factory=lambda: f"rule_{uuid.uuid4().hex[:12]}")
    tutor_id: str
    day_of_week: int  # 0=Monday, 6=Sunday
    start_time: str  # HH:MM format
    end_time: str
    timezone: str = "America/New_York"

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
    start_at: datetime
    end_at: datetime
    status: str  # hold, booked, confirmed, completed, canceled_by_consumer, canceled_by_provider
    price_snapshot: float
    policy_snapshot: Dict[str, Any]
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
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user_doc.get("password_hash") or not verify_password(data.password, user_doc["password_hash"]):
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
    
    return {"user_id": user_doc["user_id"], "token": token, "role": user_doc["role"]}

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

# ============== TUTOR PROFILE ROUTES ==============

@api_router.post("/tutors/profile", response_model=TutorProfile)
async def create_tutor_profile(data: TutorProfileCreate, request: Request):
    user = await require_auth(request)
    
    # Check if profile exists
    existing = await db.tutors.find_one({"user_id": user.user_id}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Tutor profile already exists")
    
    tutor_id = f"tutor_{uuid.uuid4().hex[:12]}"
    tutor_doc = {
        "tutor_id": tutor_id,
        "user_id": user.user_id,
        **data.dict(),
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
    query = {"is_published": True, "status": "approved"}
    
    if category:
        query["categories"] = category
    if subject:
        query["subjects"] = {"$regex": subject, "$options": "i"}
    if level:
        query["levels"] = level
    if modality:
        query["modality"] = modality
    if min_price is not None:
        query["base_price"] = {"$gte": min_price}
    if max_price is not None:
        if "base_price" in query:
            query["base_price"]["$lte"] = max_price
        else:
            query["base_price"] = {"$lte": max_price}
    
    sort_field = "rating_avg" if sort_by == "rating" else "base_price" if sort_by == "price" else "created_at"
    sort_order = -1 if sort_by == "rating" else 1
    
    skip = (page - 1) * limit
    tutors = await db.tutors.find(query, {"_id": 0}).sort(sort_field, sort_order).skip(skip).limit(limit).to_list(limit)
    
    # Get user info for each tutor
    results = []
    for tutor in tutors:
        user = await db.users.find_one({"user_id": tutor["user_id"]}, {"_id": 0})
        if user:
            results.append({
                **tutor,
                "user_name": user["name"],
                "user_picture": user.get("picture")
            })
    
    total = await db.tutors.count_documents(query)
    
    return {"tutors": results, "total": total, "page": page, "limit": limit}

@api_router.get("/tutors/{tutor_id}")
async def get_tutor(tutor_id: str):
    tutor = await db.tutors.find_one({"tutor_id": tutor_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor not found")
    
    user = await db.users.find_one({"user_id": tutor["user_id"]}, {"_id": 0})
    
    return {
        **tutor,
        "user_name": user["name"] if user else "Unknown",
        "user_picture": user.get("picture") if user else None
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
async def set_availability_rules(rules: List[AvailabilityRule], request: Request):
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
        day_of_week = current.weekday()
        date_str = current.strftime("%Y-%m-%d")
        
        # Check for exceptions on this date
        date_exceptions = [e for e in exceptions if e["date"] == date_str]
        blocked_dates = [e for e in date_exceptions if not e["is_available"]]
        
        if not blocked_dates:
            # Find rules for this day
            day_rules = [r for r in rules if r["day_of_week"] == day_of_week]
            
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
    
    booking_id = f"booking_{uuid.uuid4().hex[:12]}"
    booking_doc = {
        "booking_id": booking_id,
        "tutor_id": hold["tutor_id"],
        "consumer_id": user.user_id,
        "student_id": data.student_id,
        "start_at": hold["start_at"],
        "end_at": hold["end_at"],
        "status": "booked",
        "price_snapshot": tutor["base_price"],
        "policy_snapshot": tutor["policies"],
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
    # TODO: Process payment via Stripe
    
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
    
    result = await db.tutors.update_one(
        {"tutor_id": tutor_id},
        {"$set": {"status": "approved"}}
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
    
    return {"message": "Tutor approved"}

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

# ============== CATEGORIES ==============

@api_router.get("/categories")
async def get_categories():
    return {
        "categories": [
            {"id": "academic", "name": "Academic", "subjects": ["Math", "Science", "English", "History", "Test Prep", "Writing"]},
            {"id": "music", "name": "Music", "subjects": ["Piano", "Guitar", "Voice", "Violin", "Drums", "Music Theory"]},
            {"id": "activities", "name": "Activities", "subjects": ["Coding", "Robotics", "Art", "Chess", "Debate", "Languages"]}
        ],
        "levels": [
            {"id": "elementary", "name": "Elementary (K-5)"},
            {"id": "middle_school", "name": "Middle School (6-8)"},
            {"id": "high_school", "name": "High School (9-12)"},
            {"id": "college", "name": "College"},
            {"id": "adult", "name": "Adult"}
        ],
        "modalities": [
            {"id": "online", "name": "Online"},
            {"id": "in_person", "name": "In-Person"}
        ]
    }

# ============== HEALTH CHECK ==============

@api_router.get("/")
async def root():
    return {"message": "Acharyaly API", "version": "1.0.0"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
