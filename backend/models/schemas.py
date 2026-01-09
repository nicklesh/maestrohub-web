"""Models module - contains all Pydantic models"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid

# ============== MARKET MODELS ==============

class MarketConfig(BaseModel):
    market_id: str
    country: str  # ISO 3166-1 alpha-2
    currency: str  # ISO 4217
    currency_symbol: str
    default_timezone: str  # IANA timezone
    is_enabled: bool = True

# ============== USER MODELS ==============

class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    role: str = "consumer"  # consumer, tutor, admin
    phone: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

class User(BaseModel):
    user_id: str
    email: str
    name: str
    role: str
    phone: Optional[str] = None
    market_id: Optional[str] = None
    profile_picture: Optional[str] = None
    created_at: Optional[datetime] = None
    google_id: Optional[str] = None

# ============== TUTOR MODELS ==============

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
    base_price: float
    duration_minutes: int = 60
    policies: TutorPolicies = TutorPolicies()
    payout_country: Optional[str] = None

class TutorProfile(BaseModel):
    tutor_id: str
    user_id: str
    bio: str
    categories: List[str]
    subjects: List[str]
    levels: List[str]
    modality: List[str]
    base_price: float
    duration_minutes: int
    policies: TutorPolicies
    status: str = "pending"  # pending, approved, suspended
    is_published: bool = False
    rating_avg: float = 0.0
    rating_count: int = 0
    market_id: str = "US_USD"
    currency: str = "USD"
    currency_symbol: str = "$"
    created_at: datetime

# ============== STUDENT MODELS ==============

class StudentCreate(BaseModel):
    name: str
    age: Optional[int] = None
    grade: Optional[str] = None
    notes: Optional[str] = None
    email: Optional[str] = None

class Student(BaseModel):
    student_id: str
    parent_id: str
    name: str
    age: Optional[int] = None
    grade: Optional[str] = None
    notes: Optional[str] = None
    email: Optional[str] = None
    created_at: datetime

# ============== BOOKING MODELS ==============

class BookingHoldCreate(BaseModel):
    tutor_id: str
    start_at: str  # ISO datetime
    duration_minutes: int = 60

class IntakeForm(BaseModel):
    goals: str
    current_level: str
    notes: Optional[str] = None
    policy_acknowledged: bool = True

class BookingCreate(BaseModel):
    hold_id: str
    student_id: str
    intake: IntakeForm

class Booking(BaseModel):
    booking_id: str
    tutor_id: str
    consumer_id: str
    student_id: str
    student_name: str
    tutor_name: str
    start_at: datetime
    end_at: datetime
    status: str  # booked, confirmed, completed, canceled_by_consumer, canceled_by_provider
    price_snapshot: float
    policy_snapshot: TutorPolicies
    intake_response: IntakeForm
    created_at: datetime

# ============== AVAILABILITY MODELS ==============

class AvailabilityRule(BaseModel):
    rule_id: str
    tutor_id: str
    day_of_week: int  # 0=Monday, 6=Sunday
    start_time: str  # HH:MM
    end_time: str  # HH:MM
    is_active: bool = True

class AvailabilityRuleBulk(BaseModel):
    day_of_week: int
    slots: List[Dict[str, str]]  # [{start_time: "09:00", end_time: "10:00"}]

class AvailabilityException(BaseModel):
    exception_id: str
    tutor_id: str
    date: str  # YYYY-MM-DD
    is_available: bool = False
    slots: List[Dict[str, str]] = []  # Custom slots if available

class Vacation(BaseModel):
    vacation_id: str
    tutor_id: str
    start_date: str  # YYYY-MM-DD
    end_date: str  # YYYY-MM-DD
    reason: Optional[str] = None
    created_at: datetime

# ============== REVIEW MODELS ==============

class ReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None

class Review(BaseModel):
    review_id: str
    booking_id: str
    tutor_id: str
    consumer_id: str
    rating: int
    comment: Optional[str]
    created_at: datetime

# ============== INVITE MODELS ==============

class InviteCreate(BaseModel):
    recipient_email: str
    role_invited_as: str = "consumer"  # consumer or tutor
    message: Optional[str] = None

class Invite(BaseModel):
    invite_id: str
    inviter_id: str
    recipient_email: str
    status: str  # pending, accepted, declined
    role_invited_as: str
    message: Optional[str] = None
    created_at: datetime

# ============== BILLING MODELS ==============

class AutoPayConfig(BaseModel):
    enabled: bool
    day_of_month: int = Field(ge=1, le=28)  # 1-28 for safety

class PaymentMethodAdd(BaseModel):
    method_type: str  # card, apple_pay, google_pay, paypal, amazon_pay, zelle, venmo
    identifier: Optional[str] = None  # username/handle for Zelle/Venmo
    is_default: bool = False
