"""
Seed Data Script for Maestro Habitat
Adds 2 coaches per market (US_USD and IN_INR) for each existing subcategory
"""
import asyncio
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
import bcrypt

load_dotenv()

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'maestrohub')]

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

# Hardcoded categories (same as in server.py)
CATEGORIES = [
    {"id": "academics", "name": "Academics", "subjects": [
        "Homework Support", "Mathematics", "Advanced Mathematics", "Science", 
        "Coding/Programming", "Languages & Writing", "Social Studies & Humanities", 
        "Test Prep", "Study & Academic Skills"
    ]},
    {"id": "performance_arts", "name": "Performance & Creative Arts", "subjects": [
        "Performance Coaching", "Sports", "Music", "Acting", "Voice", "Dance", 
        "Stage Presence & Theatre", "Piano", "Guitar", "Violin", "Drums", "Music Theory"
    ]},
    {"id": "activities_hobbies", "name": "Activities & Hobbies", "subjects": [
        "Art & Design", "Yoga", "STEM & Interest Clubs", "Debates", "Photography", 
        "Cooking & Baking", "Games", "Memory Training"
    ]},
    {"id": "fitness_nutrition", "name": "Fitness & Nutrition", "subjects": [
        "Fitness Training", "Nutrition Coaching", "Weight Loss", "Recovery Coaching"
    ]},
    {"id": "health_mindfulness", "name": "Health, Mindfulness & Wellbeing", "subjects": [
        "Health Coaching", "Wellness Coaching", "Mindfulness", "Meditation", 
        "Spiritual Coaching", "Stress Management", "Mindset Coaching"
    ]},
    {"id": "business_communication", "name": "Business, Communication & Growth", "subjects": [
        "Sales Coaching", "Marketing Coaching", "Branding", "Communication Coaching", 
        "Productivity Coaching", "Business Strategy", "Image Consulting", "Personal Style"
    ]},
    {"id": "finance_legal", "name": "Finance, Legal & Negotiation", "subjects": [
        "Financial Planning", "Investment Coaching", "Retirement Planning", 
        "Real Estate Coaching", "Legal Coaching", "Negotiation Coaching"
    ]},
    {"id": "coaching_personal", "name": "Coaching & Personal Growth", "subjects": [
        "Life Coaching", "Executive Coaching", "Career Coaching", "Leadership Coaching", 
        "Agile Coaching", "Personal Development", "Confidence Coaching", 
        "Transformational Coaching", "Motivational Coaching", "Public Speaking"
    ]},
    {"id": "relationships_family", "name": "Relationships & Family", "subjects": [
        "Relationship Coaching", "Marriage Coaching", "Parenting Coaching", 
        "Fertility Coaching", "Divorce Coaching", "Grief Coaching"
    ]},
    {"id": "culture_inclusion", "name": "Culture, Inclusion & Experiences", "subjects": [
        "Diversity & Inclusion", "Team-Building", "Travel Coaching"
    ]}
]

# Sample coach data templates
US_COACHES = [
    {"name": "Alex Thompson", "bio": "Experienced educator with 10+ years teaching {subject}. Passionate about making learning fun and accessible."},
    {"name": "Sarah Johnson", "bio": "Certified {subject} instructor specializing in personalized learning approaches. Love helping students achieve their goals."},
]

IN_COACHES = [
    {"name": "Priya Sharma", "bio": "Dedicated {subject} teacher with expertise in both traditional and modern teaching methods. 8+ years experience."},
    {"name": "Rahul Patel", "bio": "Professional {subject} educator focused on building strong foundations. Fluent in English and Hindi."},
]

async def create_coach(name: str, email: str, bio: str, subjects: list, categories: list, 
                       market_id: str, payout_country: str, base_price: float):
    """Create a coach with user and tutor profile"""
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    tutor_id = f"tutor_{uuid.uuid4().hex[:8]}"
    
    # Check if email already exists
    existing = await db.users.find_one({"email": email})
    if existing:
        print(f"  ⏭️  Coach {email} already exists, skipping...")
        return None
    
    # Create user
    user_doc = {
        "user_id": user_id,
        "email": email,
        "name": name,
        "picture": None,
        "role": "tutor",
        "market_id": market_id,
        "country": payout_country,
        "password_hash": hash_password("Password123"),  # Meets password policy
        "devices": [],
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(user_doc)
    
    # Create tutor profile
    tutor_doc = {
        "tutor_id": tutor_id,
        "user_id": user_id,
        "bio": bio,
        "categories": categories,
        "subjects": subjects,
        "levels": ["elementary", "middle_school", "high_school"],
        "modality": ["online", "in_person"],
        "service_area_radius": 15,
        "base_price": base_price,
        "duration_minutes": 60,
        "payout_country": payout_country,
        "market_id": market_id,
        "timezone": "America/New_York" if payout_country == "US" else "Asia/Kolkata",
        "base_country": payout_country,
        "base_state": "NY" if payout_country == "US" else "MH",
        "base_city": "New York" if payout_country == "US" else "Mumbai",
        "status": "approved",
        "is_published": True,
        "is_sponsored": False,
        "sponsored_categories": [],
        "trial_start_at": datetime.now(timezone.utc),
        "rating_avg": round(4.0 + (hash(name) % 10) / 10, 1),  # Random 4.0-5.0
        "rating_count": (hash(name) % 20) + 5,  # Random 5-25 reviews
        "policies": {
            "cancel_window_hours": 24,
            "no_show_policy": "Full charge for no-shows",
            "late_arrival_policy": "Lesson time not extended"
        },
        "created_at": datetime.now(timezone.utc)
    }
    await db.tutors.insert_one(tutor_doc)
    
    # Create availability (Mon-Fri, 9am-5pm)
    for day in range(1, 6):  # Monday to Friday
        rule_doc = {
            "rule_id": f"rule_{uuid.uuid4().hex[:12]}",
            "tutor_id": tutor_id,
            "day_of_week": day,
            "start_time": "09:00",
            "end_time": "17:00",
            "timezone": "America/New_York" if payout_country == "US" else "Asia/Kolkata"
        }
        await db.availability_rules.insert_one(rule_doc)
    
    print(f"  ✅ Created coach: {name} ({email}) - {market_id}")
    return tutor_id

async def seed_coaches():
    """Main function to seed coaches for each subcategory"""
    print("\n🌱 Starting seed data generation...\n")
    
    categories = CATEGORIES
    
    if not categories:
        print("❌ No categories found. Please ensure categories are seeded first.")
        return
    
    print(f"📚 Found {len(categories)} categories\n")
    
    total_created = 0
    
    for category in categories:
        cat_id = category.get("id")
        cat_name = category.get("name")
        subjects = category.get("subjects", [])
        
        print(f"\n📁 Category: {cat_name} ({len(subjects)} subjects)")
        
        for subject in subjects:
            print(f"\n  📖 Subject: {subject}")
            
            # Create 2 US coaches
            for i, template in enumerate(US_COACHES):
                email = f"coach_{cat_id}_{subject.lower().replace(' ', '_')}_{i+1}_us@maestrohabitat.com"
                bio = template["bio"].format(subject=subject)
                
                await create_coach(
                    name=template["name"],
                    email=email,
                    bio=bio,
                    subjects=[subject],
                    categories=[cat_id],
                    market_id="US_USD",
                    payout_country="US",
                    base_price=50 + (hash(subject) % 50)  # $50-$100
                )
                total_created += 1
            
            # Create 2 IN coaches
            for i, template in enumerate(IN_COACHES):
                email = f"coach_{cat_id}_{subject.lower().replace(' ', '_')}_{i+1}_in@maestrohabitat.com"
                bio = template["bio"].format(subject=subject)
                
                await create_coach(
                    name=template["name"],
                    email=email,
                    bio=bio,
                    subjects=[subject],
                    categories=[cat_id],
                    market_id="IN_INR",
                    payout_country="IN",
                    base_price=500 + (hash(subject) % 500)  # ₹500-₹1000
                )
                total_created += 1
    
    print(f"\n\n✨ Seed data generation complete!")
    print(f"📊 Total coaches created: {total_created}")
    print(f"   - US coaches: {total_created // 2}")
    print(f"   - IN coaches: {total_created // 2}")

if __name__ == "__main__":
    asyncio.run(seed_coaches())
