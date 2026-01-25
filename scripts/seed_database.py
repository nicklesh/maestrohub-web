#!/usr/bin/env python3
"""
Database seeding script for Maestro Habitat
Seeds: Markets, Categories, Admin user, Sample coaches, Sample parents
"""
import os
import sys
from datetime import datetime
from pymongo import MongoClient
import hashlib
import secrets

# Load environment
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME", "maestrohub")
PASSWORD_PEPPER = os.getenv("PASSWORD_PEPPER", "")

def hash_password(password: str) -> str:
    """Hash password with pepper"""
    salted = password + PASSWORD_PEPPER
    return hashlib.sha256(salted.encode()).hexdigest()

def get_db():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]

# ============== MARKETS DATA ==============
MARKETS = [
    {"code": "US_USD", "name": "United States", "currency": "USD", "currency_symbol": "$", "country_code": "US", "flag": "🇺🇸", "is_active": True},
    {"code": "GB_GBP", "name": "United Kingdom", "currency": "GBP", "currency_symbol": "£", "country_code": "GB", "flag": "🇬🇧", "is_active": True},
    {"code": "IN_INR", "name": "India", "currency": "INR", "currency_symbol": "₹", "country_code": "IN", "flag": "🇮🇳", "is_active": True},
    {"code": "CA_CAD", "name": "Canada", "currency": "CAD", "currency_symbol": "C$", "country_code": "CA", "flag": "🇨🇦", "is_active": True},
    {"code": "AU_AUD", "name": "Australia", "currency": "AUD", "currency_symbol": "A$", "country_code": "AU", "flag": "🇦🇺", "is_active": True},
    {"code": "DE_EUR", "name": "Germany", "currency": "EUR", "currency_symbol": "€", "country_code": "DE", "flag": "🇩🇪", "is_active": True},
    {"code": "FR_EUR", "name": "France", "currency": "EUR", "currency_symbol": "€", "country_code": "FR", "flag": "🇫🇷", "is_active": True},
    {"code": "JP_JPY", "name": "Japan", "currency": "JPY", "currency_symbol": "¥", "country_code": "JP", "flag": "🇯🇵", "is_active": True},
    {"code": "SG_SGD", "name": "Singapore", "currency": "SGD", "currency_symbol": "S$", "country_code": "SG", "flag": "🇸🇬", "is_active": True},
    {"code": "AE_AED", "name": "United Arab Emirates", "currency": "AED", "currency_symbol": "د.إ", "country_code": "AE", "flag": "🇦🇪", "is_active": True},
    {"code": "BR_BRL", "name": "Brazil", "currency": "BRL", "currency_symbol": "R$", "country_code": "BR", "flag": "🇧🇷", "is_active": True},
    {"code": "MX_MXN", "name": "Mexico", "currency": "MXN", "currency_symbol": "$", "country_code": "MX", "flag": "🇲🇽", "is_active": True},
    {"code": "KR_KRW", "name": "South Korea", "currency": "KRW", "currency_symbol": "₩", "country_code": "KR", "flag": "🇰🇷", "is_active": True},
    {"code": "IL_ILS", "name": "Israel", "currency": "ILS", "currency_symbol": "₪", "country_code": "IL", "flag": "🇮🇱", "is_active": True},
    {"code": "ZA_ZAR", "name": "South Africa", "currency": "ZAR", "currency_symbol": "R", "country_code": "ZA", "flag": "🇿🇦", "is_active": True},
]

# ============== CATEGORIES DATA ==============
CATEGORIES = [
    {
        "name": "Academics",
        "icon": "school",
        "description": "Core academic subjects and tutoring",
        "subcategories": [
            {"name": "Mathematics", "icon": "calculate"},
            {"name": "Science", "icon": "science"},
            {"name": "English", "icon": "menu_book"},
            {"name": "History", "icon": "history_edu"},
            {"name": "Geography", "icon": "public"},
            {"name": "Computer Science", "icon": "computer"},
            {"name": "Physics", "icon": "bolt"},
            {"name": "Chemistry", "icon": "science"},
            {"name": "Biology", "icon": "biotech"},
        ]
    },
    {
        "name": "Languages",
        "icon": "translate",
        "description": "Language learning and communication",
        "subcategories": [
            {"name": "Spanish", "icon": "translate"},
            {"name": "French", "icon": "translate"},
            {"name": "German", "icon": "translate"},
            {"name": "Mandarin", "icon": "translate"},
            {"name": "Japanese", "icon": "translate"},
            {"name": "Hindi", "icon": "translate"},
            {"name": "Arabic", "icon": "translate"},
            {"name": "Korean", "icon": "translate"},
            {"name": "Italian", "icon": "translate"},
            {"name": "Portuguese", "icon": "translate"},
        ]
    },
    {
        "name": "Music",
        "icon": "music_note",
        "description": "Musical instruments and vocal training",
        "subcategories": [
            {"name": "Piano", "icon": "piano"},
            {"name": "Guitar", "icon": "music_note"},
            {"name": "Violin", "icon": "music_note"},
            {"name": "Drums", "icon": "music_note"},
            {"name": "Vocals", "icon": "mic"},
            {"name": "Music Theory", "icon": "library_music"},
            {"name": "Flute", "icon": "music_note"},
            {"name": "Tabla", "icon": "music_note"},
            {"name": "Harmonium", "icon": "music_note"},
        ]
    },
    {
        "name": "Arts",
        "icon": "palette",
        "description": "Visual arts and creative expression",
        "subcategories": [
            {"name": "Drawing", "icon": "brush"},
            {"name": "Painting", "icon": "palette"},
            {"name": "Sculpture", "icon": "architecture"},
            {"name": "Digital Art", "icon": "computer"},
            {"name": "Photography", "icon": "photo_camera"},
            {"name": "Crafts", "icon": "construction"},
            {"name": "Calligraphy", "icon": "edit"},
        ]
    },
    {
        "name": "Sports",
        "icon": "sports",
        "description": "Physical fitness and athletic training",
        "subcategories": [
            {"name": "Swimming", "icon": "pool"},
            {"name": "Tennis", "icon": "sports_tennis"},
            {"name": "Basketball", "icon": "sports_basketball"},
            {"name": "Soccer", "icon": "sports_soccer"},
            {"name": "Cricket", "icon": "sports_cricket"},
            {"name": "Yoga", "icon": "self_improvement"},
            {"name": "Martial Arts", "icon": "sports_martial_arts"},
            {"name": "Gymnastics", "icon": "sports_gymnastics"},
            {"name": "Badminton", "icon": "sports_tennis"},
        ]
    },
    {
        "name": "Dance",
        "icon": "directions_run",
        "description": "Dance styles and movement arts",
        "subcategories": [
            {"name": "Ballet", "icon": "directions_run"},
            {"name": "Hip Hop", "icon": "directions_run"},
            {"name": "Contemporary", "icon": "directions_run"},
            {"name": "Bharatanatyam", "icon": "directions_run"},
            {"name": "Kathak", "icon": "directions_run"},
            {"name": "Salsa", "icon": "directions_run"},
            {"name": "Jazz", "icon": "directions_run"},
        ]
    },
    {
        "name": "Test Prep",
        "icon": "quiz",
        "description": "Standardized test preparation",
        "subcategories": [
            {"name": "SAT", "icon": "quiz"},
            {"name": "ACT", "icon": "quiz"},
            {"name": "GRE", "icon": "quiz"},
            {"name": "GMAT", "icon": "quiz"},
            {"name": "TOEFL", "icon": "quiz"},
            {"name": "IELTS", "icon": "quiz"},
            {"name": "AP Exams", "icon": "quiz"},
            {"name": "IB Exams", "icon": "quiz"},
        ]
    },
    {
        "name": "Technology",
        "icon": "devices",
        "description": "Tech skills and digital literacy",
        "subcategories": [
            {"name": "Coding", "icon": "code"},
            {"name": "Web Development", "icon": "web"},
            {"name": "App Development", "icon": "phone_android"},
            {"name": "Robotics", "icon": "smart_toy"},
            {"name": "AI & Machine Learning", "icon": "psychology"},
            {"name": "Game Development", "icon": "sports_esports"},
            {"name": "Cybersecurity", "icon": "security"},
        ]
    },
    {
        "name": "Life Skills",
        "icon": "emoji_objects",
        "description": "Essential life and soft skills",
        "subcategories": [
            {"name": "Public Speaking", "icon": "record_voice_over"},
            {"name": "Leadership", "icon": "groups"},
            {"name": "Time Management", "icon": "schedule"},
            {"name": "Financial Literacy", "icon": "account_balance"},
            {"name": "Communication", "icon": "forum"},
            {"name": "Critical Thinking", "icon": "psychology"},
        ]
    },
    {
        "name": "Health & Wellness",
        "icon": "favorite",
        "description": "Physical and mental well-being",
        "subcategories": [
            {"name": "Nutrition", "icon": "restaurant"},
            {"name": "Meditation", "icon": "self_improvement"},
            {"name": "Mental Health", "icon": "psychology"},
            {"name": "First Aid", "icon": "medical_services"},
            {"name": "Fitness Training", "icon": "fitness_center"},
        ]
    },
]

# ============== SAMPLE USERS ==============
def create_sample_users(db):
    """Create admin, coaches, and parents"""
    users = []
    now = datetime.utcnow()
    
    # Admin user
    admin = {
        "email": "admin@maestrohub.com",
        "password_hash": hash_password("password123"),
        "name": "Admin User",
        "role": "admin",
        "is_active": True,
        "is_verified": True,
        "market": "US_USD",
        "created_at": now,
        "updated_at": now,
    }
    users.append(admin)
    
    # Sample coaches with different markets and specialties
    coaches_data = [
        {"email": "coach.math@test.com", "name": "Sarah Johnson", "market": "US_USD", "category": "Academics", "subcategory": "Mathematics", "price": 75, "modality": "online"},
        {"email": "coach.piano@test.com", "name": "Michael Chen", "market": "US_USD", "category": "Music", "subcategory": "Piano", "price": 85, "modality": "hybrid"},
        {"email": "coach.yoga@test.com", "name": "Priya Sharma", "market": "IN_INR", "category": "Sports", "subcategory": "Yoga", "price": 1500, "modality": "online"},
        {"email": "coach.spanish@test.com", "name": "Carlos Rodriguez", "market": "MX_MXN", "category": "Languages", "subcategory": "Spanish", "price": 800, "modality": "online"},
        {"email": "coach.coding@test.com", "name": "James Wilson", "market": "GB_GBP", "category": "Technology", "subcategory": "Coding", "price": 60, "modality": "online"},
        {"email": "coach.art@test.com", "name": "Emma Davis", "market": "AU_AUD", "category": "Arts", "subcategory": "Drawing", "price": 70, "modality": "in_person"},
        {"email": "coach.ballet@test.com", "name": "Sophie Martin", "market": "FR_EUR", "category": "Dance", "subcategory": "Ballet", "price": 65, "modality": "hybrid"},
        {"email": "coach.sat@test.com", "name": "David Kim", "market": "US_USD", "category": "Test Prep", "subcategory": "SAT", "price": 100, "modality": "online"},
        {"email": "tutor1@test.com", "name": "Test Coach One", "market": "US_USD", "category": "Academics", "subcategory": "Science", "price": 65, "modality": "online"},
        {"email": "tutor2@test.com", "name": "Test Coach Two", "market": "IN_INR", "category": "Music", "subcategory": "Tabla", "price": 1200, "modality": "hybrid"},
        {"email": "tutor3@test.com", "name": "Test Coach Three", "market": "GB_GBP", "category": "Languages", "subcategory": "French", "price": 55, "modality": "online"},
    ]
    
    for coach in coaches_data:
        user = {
            "email": coach["email"],
            "password_hash": hash_password("password123"),
            "name": coach["name"],
            "role": "tutor",
            "is_active": True,
            "is_verified": True,
            "market": coach["market"],
            "created_at": now,
            "updated_at": now,
        }
        users.append(user)
    
    # Sample parents
    parents_data = [
        {"email": "parent1@test.com", "name": "John Smith", "market": "US_USD"},
        {"email": "parent2@test.com", "name": "Anita Patel", "market": "IN_INR"},
        {"email": "parent3@test.com", "name": "Marie Dubois", "market": "FR_EUR"},
        {"email": "parent4@test.com", "name": "Hans Mueller", "market": "DE_EUR"},
        {"email": "parent5@test.com", "name": "Yuki Tanaka", "market": "JP_JPY"},
    ]
    
    for parent in parents_data:
        user = {
            "email": parent["email"],
            "password_hash": hash_password("password123"),
            "name": parent["name"],
            "role": "parent",
            "is_active": True,
            "is_verified": True,
            "market": parent["market"],
            "created_at": now,
            "updated_at": now,
            "children": [
                {"name": f"{parent['name'].split()[0]}'s Child", "age": 10, "id": secrets.token_hex(12)}
            ]
        }
        users.append(user)
    
    return users, coaches_data

def create_tutor_profiles(db, coaches_data, users_collection):
    """Create tutor profiles linked to coach users"""
    tutors = []
    now = datetime.utcnow()
    
    for coach in coaches_data:
        # Find the user
        user = users_collection.find_one({"email": coach["email"]})
        if not user:
            continue
            
        tutor = {
            "user_id": str(user["_id"]),
            "email": coach["email"],
            "name": coach["name"],
            "bio": f"Experienced {coach['subcategory']} coach with a passion for teaching. I specialize in helping students achieve their goals through personalized instruction.",
            "category": coach["category"],
            "subcategory": coach["subcategory"],
            "base_price": coach["price"],
            "currency": coach["market"].split("_")[1],
            "market": coach["market"],
            "modality": coach["modality"],
            "experience_years": 5,
            "rating": 4.5 + (hash(coach["email"]) % 10) / 20,  # Random rating 4.5-5.0
            "total_reviews": 10 + hash(coach["email"]) % 50,
            "total_sessions": 50 + hash(coach["email"]) % 200,
            "languages": ["English"],
            "availability": {
                "monday": [{"start": "09:00", "end": "17:00"}],
                "tuesday": [{"start": "09:00", "end": "17:00"}],
                "wednesday": [{"start": "09:00", "end": "17:00"}],
                "thursday": [{"start": "09:00", "end": "17:00"}],
                "friday": [{"start": "09:00", "end": "17:00"}],
            },
            "is_active": True,
            "is_verified": True,
            "created_at": now,
            "updated_at": now,
        }
        tutors.append(tutor)
    
    return tutors

def seed_database():
    """Main seeding function"""
    print("🌱 Starting database seed...")
    
    db = get_db()
    
    # Clear existing data (optional - comment out to preserve data)
    print("  Clearing existing collections...")
    db.markets.delete_many({})
    db.categories.delete_many({})
    db.users.delete_many({})
    db.tutors.delete_many({})
    
    # Seed markets
    print("  Seeding markets...")
    for market in MARKETS:
        market["created_at"] = datetime.utcnow()
        market["updated_at"] = datetime.utcnow()
    db.markets.insert_many(MARKETS)
    print(f"    ✅ {len(MARKETS)} markets created")
    
    # Seed categories
    print("  Seeding categories...")
    for cat in CATEGORIES:
        cat["created_at"] = datetime.utcnow()
        cat["updated_at"] = datetime.utcnow()
    db.categories.insert_many(CATEGORIES)
    print(f"    ✅ {len(CATEGORIES)} categories created")
    
    # Seed users
    print("  Seeding users...")
    users, coaches_data = create_sample_users(db)
    db.users.insert_many(users)
    print(f"    ✅ {len(users)} users created (1 admin, {len(coaches_data)} coaches, {len(users) - len(coaches_data) - 1} parents)")
    
    # Seed tutor profiles
    print("  Seeding tutor profiles...")
    tutors = create_tutor_profiles(db, coaches_data, db.users)
    if tutors:
        db.tutors.insert_many(tutors)
    print(f"    ✅ {len(tutors)} tutor profiles created")
    
    # Create indexes
    print("  Creating indexes...")
    db.users.create_index("email", unique=True)
    db.tutors.create_index("user_id")
    db.tutors.create_index("category")
    db.tutors.create_index("market")
    db.tutors.create_index([("category", 1), ("market", 1)])
    db.markets.create_index("code", unique=True)
    print("    ✅ Indexes created")
    
    print("\n✅ Database seeding complete!")
    print("\n📋 Test Credentials (all use password: password123):")
    print("   Admin:  admin@maestrohub.com")
    print("   Coach:  coach.math@test.com, tutor1@test.com, tutor2@test.com, tutor3@test.com")
    print("   Parent: parent1@test.com, parent2@test.com")

if __name__ == "__main__":
    seed_database()
