#!/usr/bin/env python3
"""
Database seeding script for Maestro Habitat
Seeds: Markets, Categories, Admin user, Sample coaches, Sample parents
"""
import os
import sys
from datetime import datetime
from pymongo import MongoClient
import bcrypt
import secrets

# Load environment
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME", "maestrohub")

def hash_password(password: str) -> str:
    """Hash password with bcrypt"""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

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
        "id": "academics",
        "name": "Academics",
        "icon": "school",
        "description": "Academic tutoring and test preparation",
        "subcategories": [
            {"name": "Academic Tutoring", "icon": "school"},
            {"name": "Reading & Writing", "icon": "book"},
            {"name": "History", "icon": "time"},
            {"name": "World Languages", "icon": "globe"},
            {"name": "Private Lessons", "icon": "person"},
            {"name": "1-on-1 Coaching", "icon": "people"},
            {"name": "By Learning Need", "icon": "bulb"},
            {"name": "ADHD", "icon": "flash"},
            {"name": "Autism", "icon": "heart"},
            {"name": "Dyslexia", "icon": "text"},
            {"name": "Gifted", "icon": "star"},
            {"name": "SAT/ACT", "icon": "document-text"},
            {"name": "AP Test Prep", "icon": "ribbon"},
            {"name": "Geometry", "icon": "shapes"},
            {"name": "Algebra I", "icon": "calculator"},
            {"name": "Algebra II", "icon": "calculator"},
            {"name": "College Algebra", "icon": "calculator"},
            {"name": "Linear Algebra", "icon": "grid"},
            {"name": "Trigonometry", "icon": "analytics"},
            {"name": "Pre-Calculus", "icon": "trending-up"},
            {"name": "Calculus I", "icon": "stats-chart"},
            {"name": "Calculus II", "icon": "stats-chart"},
            {"name": "College Calculus", "icon": "stats-chart"},
            {"name": "Differential Calculus", "icon": "pulse"},
            {"name": "Integral Calculus", "icon": "infinite"},
            {"name": "Statistics & Probability", "icon": "bar-chart"},
            {"name": "Homework Support", "icon": "help-circle"},
            {"name": "Mathematics", "icon": "calculator"},
            {"name": "Advanced Mathematics", "icon": "calculator"},
            {"name": "Science", "icon": "flask"},
            {"name": "Coding/Programming", "icon": "code"},
            {"name": "Social Studies & Humanities", "icon": "library"},
            {"name": "Study & Academic Skills", "icon": "school"},
        ]
    },
    {
        "id": "performance_arts",
        "name": "Performance & Creative Arts",
        "icon": "mic",
        "description": "Music, dance, acting and performance coaching",
        "subcategories": [
            {"name": "Performance Coaching", "icon": "mic"},
            {"name": "Sports", "icon": "football"},
            {"name": "Music", "icon": "musical-notes"},
            {"name": "Acting", "icon": "film"},
            {"name": "Voice", "icon": "mic"},
            {"name": "Dance", "icon": "body"},
            {"name": "Stage Presence & Theatre", "icon": "easel"},
            {"name": "Piano", "icon": "musical-note"},
            {"name": "Guitar", "icon": "musical-notes"},
            {"name": "Violin", "icon": "musical-notes"},
            {"name": "Drums", "icon": "musical-notes"},
            {"name": "Music Theory", "icon": "document-text"},
        ]
    },
    {
        "id": "activities_hobbies",
        "name": "Activities & Hobbies",
        "icon": "color-palette",
        "description": "Creative activities and hobby development",
        "subcategories": [
            {"name": "Art & Design", "icon": "brush"},
            {"name": "Yoga", "icon": "body"},
            {"name": "STEM & Interest Clubs", "icon": "rocket"},
            {"name": "Debates", "icon": "chatbubbles"},
            {"name": "Photography", "icon": "camera"},
            {"name": "Cooking & Baking", "icon": "restaurant"},
            {"name": "Games", "icon": "game-controller"},
            {"name": "Memory Training", "icon": "bulb"},
        ]
    },
    {
        "id": "fitness_nutrition",
        "name": "Fitness & Nutrition",
        "icon": "fitness",
        "description": "Physical fitness and nutrition coaching",
        "subcategories": [
            {"name": "Fitness Training", "icon": "barbell"},
            {"name": "Nutrition Coaching", "icon": "nutrition"},
            {"name": "Weight Loss", "icon": "scale"},
            {"name": "Recovery Coaching", "icon": "medkit"},
        ]
    },
    {
        "id": "health_mindfulness",
        "name": "Health, Mindfulness & Wellbeing",
        "icon": "leaf",
        "description": "Mental health, meditation and wellness",
        "subcategories": [
            {"name": "Health Coaching", "icon": "heart"},
            {"name": "Wellness Coaching", "icon": "happy"},
            {"name": "Mindfulness", "icon": "leaf"},
            {"name": "Meditation", "icon": "flower"},
            {"name": "Spiritual Coaching", "icon": "sunny"},
            {"name": "Stress Management", "icon": "pulse"},
            {"name": "Mindset Coaching", "icon": "bulb"},
        ]
    },
    {
        "id": "business_communication",
        "name": "Business, Communication & Growth",
        "icon": "briefcase",
        "description": "Business skills and professional development",
        "subcategories": [
            {"name": "Sales Coaching", "icon": "trending-up"},
            {"name": "Marketing Coaching", "icon": "megaphone"},
            {"name": "Branding", "icon": "ribbon"},
            {"name": "Communication Coaching", "icon": "chatbubbles"},
            {"name": "Productivity Coaching", "icon": "timer"},
            {"name": "Business Strategy", "icon": "analytics"},
            {"name": "Image Consulting", "icon": "shirt"},
            {"name": "Personal Style", "icon": "color-palette"},
        ]
    },
    {
        "id": "finance_legal",
        "name": "Finance, Legal & Negotiation",
        "icon": "cash",
        "description": "Financial planning and legal coaching",
        "subcategories": [
            {"name": "Financial Planning", "icon": "wallet"},
            {"name": "Investment Coaching", "icon": "trending-up"},
            {"name": "Retirement Planning", "icon": "hourglass"},
            {"name": "Real Estate Coaching", "icon": "home"},
            {"name": "Legal Coaching", "icon": "document"},
            {"name": "Negotiation Coaching", "icon": "swap-horizontal"},
        ]
    },
    {
        "id": "coaching_personal",
        "name": "Coaching & Personal Growth",
        "icon": "rocket",
        "description": "Life coaching and personal development",
        "subcategories": [
            {"name": "Life Coaching", "icon": "heart"},
            {"name": "Executive Coaching", "icon": "briefcase"},
            {"name": "Career Coaching", "icon": "trending-up"},
            {"name": "Leadership Coaching", "icon": "flag"},
            {"name": "Agile Coaching", "icon": "git-branch"},
            {"name": "Personal Development", "icon": "person"},
            {"name": "Confidence Coaching", "icon": "thumbs-up"},
            {"name": "Transformational Coaching", "icon": "sync"},
            {"name": "Motivational Coaching", "icon": "flash"},
            {"name": "Public Speaking", "icon": "mic"},
        ]
    },
    {
        "id": "relationships_family",
        "name": "Relationships & Family",
        "icon": "heart",
        "description": "Relationship and family coaching",
        "subcategories": [
            {"name": "Relationship Coaching", "icon": "heart"},
            {"name": "Marriage Coaching", "icon": "people"},
            {"name": "Parenting Coaching", "icon": "people"},
            {"name": "Fertility Coaching", "icon": "flower"},
            {"name": "Divorce Coaching", "icon": "heart-dislike"},
            {"name": "Grief Coaching", "icon": "sad"},
        ]
    },
    {
        "id": "culture_inclusion",
        "name": "Culture, Inclusion & Experiences",
        "icon": "globe",
        "description": "Diversity, inclusion and cultural experiences",
        "subcategories": [
            {"name": "Diversity & Inclusion", "icon": "people"},
            {"name": "Team-Building", "icon": "people"},
            {"name": "Travel Coaching", "icon": "airplane"},
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
            "market_id": parent["market"],  # For search filtering
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
            "tutor_id": f"tutor_{secrets.token_hex(12)}",  # Unique tutor ID
            "user_id": str(user["_id"]),
            "email": coach["email"],
            "name": coach["name"],
            "bio": f"Experienced {coach['subcategory']} coach with a passion for teaching. I specialize in helping students achieve their goals through personalized instruction.",
            "category": coach["category"],
            "categories": [coach["category"]],  # Array for search
            "subcategory": coach["subcategory"],
            "subjects": [coach["subcategory"]],  # Array for search
            "base_price": coach["price"],
            "currency": coach["market"].split("_")[1],
            "market": coach["market"],
            "market_id": coach["market"],  # Used in search queries
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
            "is_published": True,  # Required for search
            "status": "approved",  # Required for search
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
