#!/usr/bin/env python3
"""
Enhanced Duplicate Booking Prevention Testing
Tests both same tutor conflicts and consumer schedule conflicts
"""

import asyncio
import httpx
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, Any

# Get backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'https://easyslot-2.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

class BookingConflictTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.test_results = []
        
        # Test users
        self.consumer1_email = "consumer1@testbooking.com"
        self.consumer1_password = "TestPass123!"
        self.consumer1_token = None
        self.consumer1_id = None
        
        self.consumer2_email = "consumer2@testbooking.com" 
        self.consumer2_password = "TestPass123!"
        self.consumer2_token = None
        self.consumer2_id = None
        
        self.tutor1_email = "tutor1@testbooking.com"
        self.tutor1_password = "TestPass123!"
        self.tutor1_token = None
        self.tutor1_id = None
        
        self.tutor2_email = "tutor2@testbooking.com"
        self.tutor2_password = "TestPass123!"
        self.tutor2_token = None
        self.tutor2_id = None
        
        # Test data
        self.student1_id = None
        self.student2_id = None
        self.booking1_id = None
        self.booking2_id = None
        self.actual_tutor1_id = None  # Actual tutor_id from profile creation
        self.actual_tutor2_id = None  # Actual tutor_id from profile creation

    async def log_result(self, test_name: str, success: bool, message: str, details: Dict[str, Any] = None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details or {},
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}: {message}")
        if details:
            print(f"   Details: {json.dumps(details, indent=2)}")

    async def register_user(self, email: str, password: str, role: str = "consumer") -> tuple[str, str]:
        """Register a test user and return (user_id, token)"""
        try:
            response = await self.client.post(f"{API_BASE}/auth/register", json={
                "email": email,
                "password": password,
                "name": f"Test {role.title()}",
                "role": role
            })
            
            if response.status_code == 200:
                data = response.json()
                return data["user_id"], data["token"]
            elif response.status_code == 400 and "already registered" in response.text:
                # User exists, try to login
                login_response = await self.client.post(f"{API_BASE}/auth/login", json={
                    "email": email,
                    "password": password
                })
                if login_response.status_code == 200:
                    data = login_response.json()
                    return data["user_id"], data["token"]
            
            raise Exception(f"Registration failed: {response.status_code} - {response.text}")
            
        except Exception as e:
            raise Exception(f"Failed to register {email}: {str(e)}")

    async def create_tutor_profile(self, token: str, user_id: str) -> str:
        """Create tutor profile and return tutor_id"""
        try:
            headers = {"Authorization": f"Bearer {token}"}
            response = await self.client.post(f"{API_BASE}/tutors/profile", 
                headers=headers,
                json={
                    "bio": "Test tutor for booking conflict testing",
                    "categories": ["academic"],
                    "subjects": ["Math", "Science"],
                    "levels": ["elementary", "middle_school"],
                    "modality": ["online"],
                    "base_price": 50.0,
                    "duration_minutes": 60,
                    "payout_country": "US"
                }
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("tutor_id", "")
            else:
                print(f"Tutor profile creation failed: {response.status_code} - {response.text}")
                return ""
        except Exception as e:
            print(f"Failed to create tutor profile: {e}")
            return ""

    async def create_student(self, token: str) -> str:
        """Create a test student and return student_id"""
        try:
            headers = {"Authorization": f"Bearer {token}"}
            response = await self.client.post(f"{API_BASE}/students",
                headers=headers,
                json={
                    "name": "Test Student",
                    "age": 12,
                    "grade": "7th"
                }
            )
            if response.status_code == 200:
                return response.json()["student_id"]
            else:
                raise Exception(f"Failed to create student: {response.status_code} - {response.text}")
        except Exception as e:
            raise Exception(f"Student creation error: {str(e)}")

    async def create_booking_hold(self, token: str, tutor_id: str, start_time: datetime) -> tuple[bool, str, dict]:
        """Create booking hold and return (success, hold_id, response_data)"""
        try:
            headers = {"Authorization": f"Bearer {token}"}
            response = await self.client.post(f"{API_BASE}/booking-holds",
                headers=headers,
                json={
                    "tutor_id": tutor_id,
                    "start_at": start_time.isoformat(),
                    "duration_minutes": 60
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                return True, data["hold_id"], data
            else:
                return False, "", response.json() if response.status_code != 500 else {"error": response.text}
                
        except Exception as e:
            return False, "", {"error": str(e)}

    async def create_booking(self, token: str, hold_id: str, student_id: str) -> tuple[bool, str, dict]:
        """Create booking from hold and return (success, booking_id, response_data)"""
        try:
            headers = {"Authorization": f"Bearer {token}"}
            response = await self.client.post(f"{API_BASE}/bookings",
                headers=headers,
                json={
                    "hold_id": hold_id,
                    "student_id": student_id,
                    "intake": {
                        "goals": "Test booking for conflict testing",
                        "current_level": "Beginner",
                        "policy_acknowledged": True
                    }
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                return True, data["booking_id"], data
            else:
                return False, "", response.json() if response.status_code != 500 else {"error": response.text}
                
        except Exception as e:
            return False, "", {"error": str(e)}

    async def reschedule_booking(self, token: str, booking_id: str, new_start: datetime) -> tuple[bool, dict]:
        """Reschedule booking to new time and return (success, response_data)"""
        try:
            headers = {"Authorization": f"Bearer {token}"}
            new_end = new_start + timedelta(hours=1)
            response = await self.client.put(f"{API_BASE}/bookings/{booking_id}/timeslot",
                headers=headers,
                json={
                    "start_at": new_start.isoformat(),
                    "end_at": new_end.isoformat()
                }
            )
            
            if response.status_code == 200:
                return True, response.json()
            else:
                return False, response.json() if response.status_code != 500 else {"error": response.text}
                
        except Exception as e:
            return False, {"error": str(e)}

    async def setup_test_users(self):
        """Setup all test users and profiles"""
        print("🔧 Setting up test users...")
        
        # Register consumers
        self.consumer1_id, self.consumer1_token = await self.register_user(
            self.consumer1_email, self.consumer1_password, "consumer"
        )
        self.consumer2_id, self.consumer2_token = await self.register_user(
            self.consumer2_email, self.consumer2_password, "consumer"
        )
        
        # Register tutors
        self.tutor1_id, self.tutor1_token = await self.register_user(
            self.tutor1_email, self.tutor1_password, "tutor"
        )
        self.tutor2_id, self.tutor2_token = await self.register_user(
            self.tutor2_email, self.tutor2_password, "tutor"
        )
        
        # Create tutor profiles and get actual tutor_ids
        self.actual_tutor1_id = await self.create_tutor_profile(self.tutor1_token, self.tutor1_id)
        self.actual_tutor2_id = await self.create_tutor_profile(self.tutor2_token, self.tutor2_id)
        
        if not self.actual_tutor1_id or not self.actual_tutor2_id:
            raise Exception("Failed to create tutor profiles")
        
        # Create students for consumers
        self.student1_id = await self.create_student(self.consumer1_token)
        self.student2_id = await self.create_student(self.consumer2_token)
        
        print(f"✅ Setup complete - Consumer1: {self.consumer1_id}, Consumer2: {self.consumer2_id}")
        print(f"   Tutor1: {self.actual_tutor1_id}, Tutor2: {self.actual_tutor2_id}")

    async def test_scenario_1_same_tutor_duplicate_prevention(self):
        """
        Scenario 1: Same Tutor Duplicate Prevention
        1. Consumer creates booking with Tutor1 at specific time
        2. Same consumer tries to book same tutor at same time
        3. Expected: 409 Conflict with "This coach is already booked at this time"
        """
        print("\n📋 Testing Scenario 1: Same Tutor Duplicate Prevention")
        
        # Step 1: Create first booking
        future_time = datetime.now(timezone.utc) + timedelta(hours=24)
        
        # Create hold for first booking
        success, hold_id, hold_data = await self.create_booking_hold(
            self.consumer1_token, self.actual_tutor1_id, future_time
        )
        
        if not success:
            await self.log_result(
                "Scenario 1 - Setup", False, 
                f"Failed to create initial booking hold: {hold_data}"
            )
            return
        
        # Complete first booking
        success, booking_id, booking_data = await self.create_booking(
            self.consumer1_token, hold_id, self.student1_id
        )
        
        if not success:
            await self.log_result(
                "Scenario 1 - Setup", False,
                f"Failed to create initial booking: {booking_data}"
            )
            return
        
        self.booking1_id = booking_id
        await self.log_result(
            "Scenario 1 - Setup", True,
            f"Successfully created initial booking {booking_id} at {future_time}"
        )
        
        # Step 2: Try to create duplicate booking hold at same time with same tutor
        success, duplicate_hold_id, duplicate_data = await self.create_booking_hold(
            self.consumer1_token, self.actual_tutor1_id, future_time
        )
        
        if success:
            await self.log_result(
                "Scenario 1 - Same Tutor Duplicate", False,
                "Expected 409 conflict but booking hold was created successfully",
                {"hold_id": duplicate_hold_id, "response": duplicate_data}
            )
        else:
            # Check if we got the expected 409 error
            error_message = duplicate_data.get("detail", "")
            if "already booked at this time" in error_message or "coach is already booked" in error_message.lower():
                await self.log_result(
                    "Scenario 1 - Same Tutor Duplicate", True,
                    f"✅ Correctly prevented duplicate booking: {error_message}",
                    {"expected_error": error_message}
                )
            else:
                await self.log_result(
                    "Scenario 1 - Same Tutor Duplicate", False,
                    f"Got error but not the expected message: {error_message}",
                    {"actual_error": duplicate_data}
                )

    async def test_scenario_2_consumer_schedule_conflict_prevention(self):
        """
        Scenario 2: Consumer Schedule Conflict Prevention (NEW)
        1. Use same consumer from scenario 1 (already has booking with Tutor1)
        2. Try to create booking hold with DIFFERENT tutor (Tutor2) at SAME time
        3. Expected: 409 Conflict with "You already have a session booked at this time"
        """
        print("\n📋 Testing Scenario 2: Consumer Schedule Conflict Prevention")
        
        if not self.booking1_id:
            await self.log_result(
                "Scenario 2 - Prerequisites", False,
                "Scenario 1 must complete successfully first"
            )
            return
        
        # Get the time from the existing booking
        future_time = datetime.now(timezone.utc) + timedelta(hours=24)
        
        # Try to create booking hold with DIFFERENT tutor at SAME time
        success, hold_id, hold_data = await self.create_booking_hold(
            self.consumer1_token, self.actual_tutor2_id, future_time
        )
        
        if success:
            await self.log_result(
                "Scenario 2 - Consumer Schedule Conflict", False,
                "Expected 409 conflict but booking hold was created with different tutor",
                {"hold_id": hold_id, "response": hold_data}
            )
        else:
            # Check if we got the expected consumer conflict error
            error_message = hold_data.get("detail", "")
            if "already have a session booked at this time" in error_message:
                await self.log_result(
                    "Scenario 2 - Consumer Schedule Conflict", True,
                    f"✅ Correctly prevented consumer schedule conflict: {error_message}",
                    {"expected_error": error_message}
                )
            else:
                await self.log_result(
                    "Scenario 2 - Consumer Schedule Conflict", False,
                    f"Got error but not the expected consumer conflict message: {error_message}",
                    {"actual_error": hold_data}
                )

    async def test_scenario_3_reschedule_conflict_prevention(self):
        """
        Scenario 3: Reschedule Conflict Prevention
        1. Consumer2 creates booking with Tutor2 at different time
        2. Consumer1 tries to reschedule their existing booking to overlap with Consumer2's booking
        3. Expected: 400 Error with "You already have another session booked at this time"
        """
        print("\n📋 Testing Scenario 3: Reschedule Conflict Prevention")
        
        # Step 1: Create second booking with different consumer and tutor at different time
        different_time = datetime.now(timezone.utc) + timedelta(hours=48)  # 48 hours from now
        
        # Create hold for Consumer2 with Tutor2
        success, hold_id, hold_data = await self.create_booking_hold(
            self.consumer2_token, self.actual_tutor2_id, different_time
        )
        
        if not success:
            await self.log_result(
                "Scenario 3 - Setup", False,
                f"Failed to create second booking hold: {hold_data}"
            )
            return
        
        # Complete second booking
        success, booking2_id, booking_data = await self.create_booking(
            self.consumer2_token, hold_id, self.student2_id
        )
        
        if not success:
            await self.log_result(
                "Scenario 3 - Setup", False,
                f"Failed to create second booking: {booking_data}"
            )
            return
        
        self.booking2_id = booking2_id
        await self.log_result(
            "Scenario 3 - Setup", True,
            f"Successfully created second booking {booking2_id} at {different_time}"
        )
        
        # Step 2: Create third booking for Consumer1 with Tutor1 at yet another time
        third_time = datetime.now(timezone.utc) + timedelta(hours=72)  # 72 hours from now
        
        success, hold_id3, hold_data3 = await self.create_booking_hold(
            self.consumer1_token, self.actual_tutor1_id, third_time
        )
        
        if not success:
            await self.log_result(
                "Scenario 3 - Setup Third Booking", False,
                f"Failed to create third booking hold: {hold_data3}"
            )
            return
        
        success, booking3_id, booking_data3 = await self.create_booking(
            self.consumer1_token, hold_id3, self.student1_id
        )
        
        if not success:
            await self.log_result(
                "Scenario 3 - Setup Third Booking", False,
                f"Failed to create third booking: {booking_data3}"
            )
            return
        
        await self.log_result(
            "Scenario 3 - Setup Third Booking", True,
            f"Successfully created third booking {booking3_id} at {third_time}"
        )
        
        # Step 3: Try to reschedule Consumer1's third booking to overlap with Consumer2's booking time
        # This should fail because Consumer1 already has their first booking at 24 hours
        # Let's try to reschedule to the same time as Consumer2's booking (48 hours)
        success, reschedule_data = await self.reschedule_booking(
            self.consumer1_token, booking3_id, different_time
        )
        
        if success:
            await self.log_result(
                "Scenario 3 - Reschedule Conflict", False,
                "Expected 400 error but reschedule was successful",
                {"response": reschedule_data}
            )
        else:
            # Check if we got the expected reschedule conflict error
            error_message = reschedule_data.get("detail", "")
            if "already have another session booked" in error_message or "already booked at this time" in error_message:
                await self.log_result(
                    "Scenario 3 - Reschedule Conflict", True,
                    f"✅ Correctly prevented reschedule conflict: {error_message}",
                    {"expected_error": error_message}
                )
            else:
                await self.log_result(
                    "Scenario 3 - Reschedule Conflict", False,
                    f"Got error but not the expected reschedule conflict message: {error_message}",
                    {"actual_error": reschedule_data}
                )

    async def test_additional_edge_cases(self):
        """Test additional edge cases for comprehensive coverage"""
        print("\n📋 Testing Additional Edge Cases")
        
        # Edge Case 1: Different consumer trying to book same tutor at same time
        future_time = datetime.now(timezone.utc) + timedelta(hours=24)
        
        success, hold_id, hold_data = await self.create_booking_hold(
            self.consumer2_token, self.actual_tutor1_id, future_time
        )
        
        if success:
            await self.log_result(
                "Edge Case - Different Consumer Same Tutor", False,
                "Expected 409 conflict but different consumer could book same tutor at same time",
                {"hold_id": hold_id}
            )
        else:
            error_message = hold_data.get("detail", "")
            if "already booked at this time" in error_message or "coach is already booked" in error_message.lower():
                await self.log_result(
                    "Edge Case - Different Consumer Same Tutor", True,
                    f"✅ Correctly prevented different consumer from booking same tutor: {error_message}"
                )
            else:
                await self.log_result(
                    "Edge Case - Different Consumer Same Tutor", False,
                    f"Unexpected error message: {error_message}",
                    {"actual_error": hold_data}
                )

    async def run_all_tests(self):
        """Run all booking conflict tests"""
        print("🚀 Starting Enhanced Duplicate Booking Prevention Tests")
        print(f"Backend URL: {BACKEND_URL}")
        
        try:
            # Setup
            await self.setup_test_users()
            
            # Run test scenarios
            await self.test_scenario_1_same_tutor_duplicate_prevention()
            await self.test_scenario_2_consumer_schedule_conflict_prevention()
            await self.test_scenario_3_reschedule_conflict_prevention()
            await self.test_additional_edge_cases()
            
            # Summary
            total_tests = len(self.test_results)
            passed_tests = len([r for r in self.test_results if r["success"]])
            failed_tests = total_tests - passed_tests
            
            print(f"\n📊 TEST SUMMARY")
            print(f"Total Tests: {total_tests}")
            print(f"✅ Passed: {passed_tests}")
            print(f"❌ Failed: {failed_tests}")
            print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
            
            if failed_tests > 0:
                print(f"\n❌ FAILED TESTS:")
                for result in self.test_results:
                    if not result["success"]:
                        print(f"   - {result['test']}: {result['message']}")
            
            return passed_tests, failed_tests, self.test_results
            
        except Exception as e:
            print(f"❌ Test execution failed: {str(e)}")
            return 0, 1, [{"test": "Test Execution", "success": False, "message": str(e)}]
        
        finally:
            await self.client.aclose()

async def main():
    """Main test execution"""
    tester = BookingConflictTester()
    passed, failed, results = await tester.run_all_tests()
    
    # Save detailed results
    with open("/app/booking_conflict_test_results.json", "w") as f:
        json.dump({
            "summary": {
                "total_tests": len(results),
                "passed": passed,
                "failed": failed,
                "success_rate": f"{(passed/(passed+failed)*100):.1f}%" if (passed+failed) > 0 else "0%"
            },
            "test_results": results,
            "timestamp": datetime.now().isoformat()
        }, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/booking_conflict_test_results.json")
    
    # Return appropriate exit code
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)