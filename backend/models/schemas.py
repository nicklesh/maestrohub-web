"""
Pydantic Models for Maestro Habitat
"""
from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

# ============== MARKET MODELS ==============

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

# ============== USER MODELS ==============

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

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

# ============== STUDENT MODELS ==============

class StudentCreate(BaseModel):
    name: str
    age: Optional[int] = None
    grade: Optional[str] = None
    notes: Optional[str] = None
    email: Optional[EmailStr] = None  # Kid's email for sending schedules
    phone: Optional[str] = None  # Kid's phone for SMS notifications
    auto_send_schedule: bool = False  # Auto-send quarterly schedules
    notify_upcoming_sessions: bool = False  # Send session reminders to kid

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
    phone: Optional[str] = None
    auto_send_schedule: Optional[bool] = None
    notify_upcoming_sessions: Optional[bool] = None

# ============== TUTOR MODELS ==============

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

# ============== AVAILABILITY MODELS ==============

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

# ============== BOOKING MODELS ==============

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

# ============== REVIEW MODELS ==============

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

class SessionPackageCreate(BaseModel):
    name: str
    num_sessions: int
    price_per_session: float
    discount_percent: float = 0.0
    description: Optional[str] = None
    is_active: bool = True

class SessionPackage(SessionPackageCreate):
    package_id: str
    tutor_id: str
    created_at: datetime

# ============== DETAILED REVIEWS ==============

class DetailedReviewCreate(BaseModel):
    booking_id: str
    rating: int = Field(ge=1, le=5)
    comment: str
    would_recommend: bool = True
    categories: Optional[Dict[str, int]] = None  # e.g., {"teaching_quality": 5, "communication": 4}

class DetailedReview(DetailedReviewCreate):
    review_id: str
    tutor_id: str
    consumer_id: str
    consumer_name: Optional[str] = None
    response: Optional[str] = None  # Tutor's response
    response_at: Optional[datetime] = None
    created_at: datetime

class ReviewResponse(BaseModel):
    response: str

# ============== SPONSORSHIP MODELS ==============

class SponsorshipPlan(BaseModel):
    plan_id: str
    name: str
    price_per_week: float
    features: List[str]
    max_categories: int = 1
    search_boost: float = 1.5  # Multiplier for search ranking
    is_active: bool = True

class SponsorshipCreate(BaseModel):
    plan_id: str
    categories: List[str]  # Categories to be sponsored in
    duration_weeks: int = 4

class Sponsorship(BaseModel):
    sponsorship_id: str
    tutor_id: str
    plan_id: str
    categories: List[str]
    starts_at: datetime
    expires_at: datetime
    status: str  # active, expired, cancelled
    amount_paid: float
    created_at: datetime

# ============== INVITE MODELS ==============

class ProviderInviteCreate(BaseModel):
    tutor_email: EmailStr
    tutor_name: Optional[str] = None
    message: Optional[str] = None

class ParentInviteCreate(BaseModel):
    invitee_email: EmailStr
    invitee_name: Optional[str] = None
    message: Optional[str] = None

# ============== REFERRAL MODELS ==============

class Referral(BaseModel):
    referral_id: str
    referrer_id: str  # User who referred
    referrer_role: str  # consumer or tutor
    referred_id: str  # User who was referred
    referred_role: str  # consumer or tutor
    status: str  # pending, qualified, rewarded
    sessions_completed: int = 0  # Track completed paid sessions
    reward_type: Optional[str] = None  # free_session or fee_waiver
    reward_applied: bool = False
    created_at: datetime
    qualified_at: Optional[datetime] = None  # When 2 sessions completed
    rewarded_at: Optional[datetime] = None

# ============== TAX REPORT MODELS ==============

class TaxReportRequest(BaseModel):
    year: int
    market_id: Optional[str] = None

class TaxReport(BaseModel):
    report_id: str
    user_id: str
    user_role: str  # consumer or tutor
    year: int
    market_id: str
    status: str  # pending, generating, ready, failed
    report_type: str  # 1099 for US, equivalent for others
    total_amount: float
    currency: str
    file_url: Optional[str] = None
    created_at: datetime
    generated_at: Optional[datetime] = None

# ============== KID NOTIFICATION MODELS ==============

class KidNotification(BaseModel):
    notification_id: str
    booking_id: str
    student_id: str
    notification_type: str  # email or sms
    sent_to: str  # email address or phone number
    sent_at: datetime
    status: str  # sent, delivered, failed

# ============== REMINDER CONFIG ==============

class ReminderConfig(BaseModel):
    session_reminder_hours: int = 1  # Hours before session
    payment_reminder_days: int = 1  # Days before payment due
    weekly_summary: bool = True

# ============== CONTACT/SUPPORT ==============

class ContactRequest(BaseModel):
    subject: str
    message: str

# ============== PAYMENT MODELS ==============

class PaymentMethodCreate(BaseModel):
    type: str  # card, apple_pay, google_pay, upi
    provider: str  # stripe, razorpay
    token: Optional[str] = None
    last_four: Optional[str] = None
    brand: Optional[str] = None
    is_default: bool = False

class PaymentProcess(BaseModel):
    booking_id: str
    payment_method_id: str
    amount_cents: int
