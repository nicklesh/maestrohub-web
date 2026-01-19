"""
Seed Reviews Script for Maestro Habitat
Creates review data for parent1@test.com
"""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
import random
from dotenv import load_dotenv

load_dotenv()

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'maestrohub')]

# Sample review comments
POSITIVE_COMMENTS = [
    "Excellent teacher! Very patient and knowledgeable. Highly recommend!",
    "My child has improved so much since starting sessions. Great communication!",
    "Professional and punctual. Makes learning fun and engaging.",
    "Very thorough and explains concepts clearly. Worth every penny!",
    "Amazing tutor! Really understands how to work with different learning styles.",
    "Helped my child build confidence in the subject. Thank you!",
    "Best tutor we've had. Very organized and well-prepared for each session.",
    "Great at breaking down complex topics. My child looks forward to the lessons.",
    "Friendly, encouraging, and incredibly skilled. Wonderful experience!",
    "Top-notch instruction. Saw improvement after just a few sessions."
]

async def seed_reviews_for_user(email: str):
    """Create sample reviews and bookings for a specific user"""
    print(f"\n🌱 Seeding reviews for {email}...\n")
    
    # Find the user
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        print(f"❌ User {email} not found!")
        return
    
    user_id = user["user_id"]
    user_name = user.get("name", "Parent User")
    print(f"✅ Found user: {user_name} ({user_id})")
    
    # Get some tutors to create bookings and reviews for
    tutors = await db.tutors.find(
        {"status": "approved", "is_published": True},
        {"_id": 0}
    ).limit(5).to_list(5)
    
    if not tutors:
        print("❌ No tutors found to create reviews for!")
        return
    
    print(f"📚 Found {len(tutors)} tutors to create reviews for\n")
    
    # Get or create a student for this user
    student = await db.students.find_one({"consumer_id": user_id}, {"_id": 0})
    if not student:
        student = {
            "student_id": f"stu_{uuid.uuid4().hex[:12]}",
            "consumer_id": user_id,
            "name": "Demo Child",
            "age": 12,
            "grade": "7th Grade",
            "created_at": datetime.now(timezone.utc)
        }
        await db.students.insert_one(student)
        print(f"✅ Created student: {student['name']}")
    
    bookings_created = 0
    reviews_created = 0
    
    for i, tutor in enumerate(tutors):
        tutor_id = tutor["tutor_id"]
        tutor_user = await db.users.find_one({"user_id": tutor["user_id"]}, {"_id": 0})
        tutor_name = tutor_user.get("name", "Unknown Coach") if tutor_user else "Unknown Coach"
        
        print(f"\n  📖 Processing tutor: {tutor_name}")
        
        # Check if booking already exists
        existing_booking = await db.bookings.find_one({
            "consumer_id": user_id,
            "tutor_id": tutor_id
        })
        
        if existing_booking:
            booking_id = existing_booking["booking_id"]
            print(f"    ⏭️  Booking already exists: {booking_id}")
        else:
            # Create a completed booking
            booking_id = f"book_{uuid.uuid4().hex[:12]}"
            start_time = datetime.now(timezone.utc) - timedelta(days=30 - i*5)
            
            booking = {
                "booking_id": booking_id,
                "consumer_id": user_id,
                "tutor_id": tutor_id,
                "tutor_name": tutor_name,
                "student_id": student["student_id"],
                "student_name": student["name"],
                "start_at": start_time,
                "end_at": start_time + timedelta(hours=1),
                "status": "completed",
                "price_snapshot": tutor.get("base_price", 50),
                "currency": tutor.get("market_id", "US_USD").split("_")[1],
                "currency_symbol": "$" if "US" in tutor.get("market_id", "") else "₹",
                "policy_snapshot": tutor.get("policies", {
                    "cancel_window_hours": 24,
                    "no_show_policy": "Full charge for no-shows"
                }),
                "intake_response": {
                    "goals": "Improve understanding and grades",
                    "current_level": "Intermediate",
                    "notes": "Looking forward to learning!"
                },
                "created_at": start_time - timedelta(days=7)
            }
            await db.bookings.insert_one(booking)
            bookings_created += 1
            print(f"    ✅ Created booking: {booking_id}")
        
        # Check if review already exists
        existing_review = await db.detailed_reviews.find_one({
            "consumer_id": user_id,
            "tutor_id": tutor_id
        })
        
        if existing_review:
            print(f"    ⏭️  Review already exists for this tutor")
            continue
        
        # Create a detailed review
        ratings = {
            "teaching_quality": random.randint(4, 5),
            "communication": random.randint(4, 5),
            "punctuality": random.randint(4, 5),
            "knowledge": random.randint(4, 5),
            "value_for_money": random.randint(4, 5)
        }
        overall = sum(ratings.values()) / 5
        
        review = {
            "review_id": f"rev_{uuid.uuid4().hex[:12]}",
            "booking_id": booking_id,
            "tutor_id": tutor_id,
            "consumer_id": user_id,
            "consumer_name": user_name,
            "teaching_quality": ratings["teaching_quality"],
            "communication": ratings["communication"],
            "punctuality": ratings["punctuality"],
            "knowledge": ratings["knowledge"],
            "value_for_money": ratings["value_for_money"],
            "overall_rating": round(overall, 1),
            "comment": random.choice(POSITIVE_COMMENTS),
            "would_recommend": True,
            "created_at": datetime.now(timezone.utc) - timedelta(days=25 - i*5)
        }
        
        await db.detailed_reviews.insert_one(review)
        reviews_created += 1
        print(f"    ✅ Created review: {review['review_id']} (Rating: {review['overall_rating']})")
        
        # Update tutor's average rating
        all_reviews = await db.detailed_reviews.find({"tutor_id": tutor_id}, {"_id": 0}).to_list(1000)
        if all_reviews:
            avg_rating = sum(r["overall_rating"] for r in all_reviews) / len(all_reviews)
            await db.tutors.update_one(
                {"tutor_id": tutor_id},
                {"$set": {"rating_avg": round(avg_rating, 1), "rating_count": len(all_reviews)}}
            )
            print(f"    📊 Updated tutor rating: {round(avg_rating, 1)} ({len(all_reviews)} reviews)")
    
    print(f"\n✨ Done! Created {bookings_created} bookings and {reviews_created} reviews for {email}")

async def main():
    await seed_reviews_for_user("parent1@test.com")
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
