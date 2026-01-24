#!/usr/bin/env python3
"""
Backend API Testing for Maestro Hub - Duplicate Booking Prevention
Tests the duplicate booking prevention feature (409 Conflict)
"""

import asyncio
import httpx
import json
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://easyslot-2.preview.emergentagent.com/api"
TIMEOUT = 30.0

class TestResults:
    def __init__(self):
        self.results = []
        self.passed = 0
        self.failed = 0
    
    def add_result(self, test_name: str, passed: bool, message: str, details: Dict = None):
        result = {
            "test": test_name,
            "passed": passed,
            "message": message,
            "details": details or {}
        }
        self.results.append(result)
        if passed:
            self.passed += 1
        else:
            self.failed += 1
        
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {test_name}: {message}")
        if details:
            print(f"    Details: {details}")
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n=== TEST SUMMARY ===")
        print(f"Total Tests: {total}")
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        print(f"Success Rate: {(self.passed/total*100):.1f}%" if total > 0 else "No tests run")
        return self.passed, self.failed

class MaestroHubTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=TIMEOUT)
        self.results = TestResults()
        self.auth_token = None
        self.user_id = None
        self.tutor_id = None
        self.student_id = None
        
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
    
    async def make_request(self, method: str, endpoint: str, data: Dict = None, headers: Dict = None) -> tuple[int, Dict]:
        """Make HTTP request and return status code and response data"""
        url = f"{BASE_URL}{endpoint}"
        request_headers = {"Content-Type": "application/json"}
        
        if self.auth_token:
            request_headers["Authorization"] = f"Bearer {self.auth_token}"
        
        if headers:
            request_headers.update(headers)
        
        try:
            if method.upper() == "GET":
                response = await self.client.get(url, headers=request_headers)
            elif method.upper() == "POST":
                response = await self.client.post(url, json=data, headers=request_headers)
            elif method.upper() == "PUT":
                response = await self.client.put(url, json=data, headers=request_headers)
            elif method.upper() == "DELETE":
                response = await self.client.delete(url, headers=request_headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            try:
                response_data = response.json()
            except:
                response_data = {"text": response.text}
            
            return response.status_code, response_data
        
        except Exception as e:
            return 0, {"error": str(e)}
    
    async def test_consumer_login(self):
        """Test consumer login with provided credentials"""
        test_name = "Consumer Login"
        
        # Try parent2@test.com first
        login_data = {
            "email": "parent2@test.com",
            "password": "Password123!"
        }
        
        status, response = await self.make_request("POST", "/auth/login", login_data)
        
        if status == 200 and "token" in response:
            self.auth_token = response["token"]
            self.user_id = response["user_id"]
            self.results.add_result(test_name, True, f"Login successful for {login_data['email']}", 
                                  {"user_id": self.user_id, "role": response.get("role")})
            return True
        else:
            # Try registering a new consumer if login fails
            register_data = {
                "email": f"testconsumer_{uuid.uuid4().hex[:8]}@test.com",
                "password": "TestPassword123!",
                "name": "Test Consumer",
                "role": "consumer"
            }
            
            status, response = await self.make_request("POST", "/auth/register", register_data)
            
            if status == 200 and "token" in response:
                self.auth_token = response["token"]
                self.user_id = response["user_id"]
                self.results.add_result(test_name, True, f"New consumer registered: {register_data['email']}", 
                                      {"user_id": self.user_id})
                return True
            else:
                self.results.add_result(test_name, False, f"Login/registration failed: {response}", 
                                      {"status": status})
                return False
    
    async def test_get_tutors(self):
        """Get available tutors for booking"""
        test_name = "Get Available Tutors"
        
        status, response = await self.make_request("GET", "/tutors/search")
        
        if status == 200 and "tutors" in response:
            tutors = response["tutors"]
            if tutors:
                # Use first available tutor
                self.tutor_id = tutors[0]["tutor_id"]
                self.results.add_result(test_name, True, f"Found {len(tutors)} tutors, using {self.tutor_id}")
                return True
            else:
                # Create a test tutor if none exist
                return await self.create_test_tutor()
        else:
            self.results.add_result(test_name, False, f"Failed to get tutors: {response}", {"status": status})
            return False
    
    async def create_test_tutor(self):
        """Create a test tutor for booking tests"""
        test_name = "Create Test Tutor"
        
        # Register tutor user
        tutor_email = f"testtutor_{uuid.uuid4().hex[:8]}@test.com"
        register_data = {
            "email": tutor_email,
            "password": "TutorPassword123!",
            "name": "Test Tutor",
            "role": "tutor"
        }
        
        status, response = await self.make_request("POST", "/auth/register", register_data)
        
        if status != 200:
            self.results.add_result(test_name, False, f"Failed to register tutor: {response}")
            return False
        
        tutor_user_id = response["user_id"]
        tutor_token = response["token"]
        
        # Create tutor profile
        profile_data = {
            "bio": "Test tutor for duplicate booking prevention testing",
            "categories": ["academic"],
            "subjects": ["Math", "Science"],
            "levels": ["elementary", "middle_school"],
            "modality": ["online"],
            "base_price": 50.0,
            "duration_minutes": 60,
            "payout_country": "US"
        }
        
        # Use tutor token for profile creation
        temp_token = self.auth_token
        self.auth_token = tutor_token
        
        status, response = await self.make_request("POST", "/tutors/profile", profile_data)
        
        # Restore consumer token
        self.auth_token = temp_token
        
        if status == 200 and "tutor_id" in response:
            self.tutor_id = response["tutor_id"]
            self.results.add_result(test_name, True, f"Created test tutor: {self.tutor_id}")
            return True
        else:
            self.results.add_result(test_name, False, f"Failed to create tutor profile: {response}")
            return False
    
    async def test_create_student(self):
        """Create a student for booking"""
        test_name = "Create Student"
        
        student_data = {
            "name": "Test Student",
            "age": 12,
            "grade": "7th Grade",
            "notes": "Test student for duplicate booking prevention"
        }
        
        status, response = await self.make_request("POST", "/students", student_data)
        
        if status == 200 and "student_id" in response:
            self.student_id = response["student_id"]
            self.results.add_result(test_name, True, f"Created student: {self.student_id}")
            return True
        else:
            self.results.add_result(test_name, False, f"Failed to create student: {response}", {"status": status})
            return False
    
    async def test_get_tutor_availability(self):
        """Get tutor availability"""
        test_name = "Get Tutor Availability"
        
        if not self.tutor_id:
            self.results.add_result(test_name, False, "No tutor ID available")
            return False
        
        status, response = await self.make_request("GET", f"/tutors/{self.tutor_id}/availability")
        
        if status == 200:
            self.results.add_result(test_name, True, "Retrieved tutor availability", {"availability": response})
            return True
        else:
            self.results.add_result(test_name, False, f"Failed to get availability: {response}", {"status": status})
            return False
    
    async def test_duplicate_booking_prevention(self):
        """Main test: Duplicate booking prevention (409 Conflict)"""
        test_name = "Duplicate Booking Prevention"
        
        if not all([self.tutor_id, self.student_id]):
            self.results.add_result(test_name, False, "Missing tutor_id or student_id")
            return False
        
        # Step 1: Create first booking hold
        future_time = datetime.now(timezone.utc) + timedelta(days=1, hours=10)  # Tomorrow at 10 AM
        
        hold_data = {
            "tutor_id": self.tutor_id,
            "start_at": future_time.isoformat(),
            "duration_minutes": 60
        }
        
        print(f"\n--- Testing Duplicate Booking Prevention ---")
        print(f"Tutor ID: {self.tutor_id}")
        print(f"Student ID: {self.student_id}")
        print(f"Time slot: {future_time.isoformat()}")
        
        # Create first hold
        status1, response1 = await self.make_request("POST", "/booking-holds", hold_data)
        
        if status1 != 200:
            self.results.add_result(test_name, False, f"Failed to create first hold: {response1}", {"status": status1})
            return False
        
        hold_id = response1["hold_id"]
        print(f"✅ First hold created: {hold_id}")
        
        # Step 2: Complete first booking
        booking_data = {
            "hold_id": hold_id,
            "student_id": self.student_id,
            "intake": {
                "goals": "Test duplicate booking prevention",
                "current_level": "Beginner",
                "notes": "Testing duplicate booking",
                "policy_acknowledged": True
            }
        }
        
        status2, response2 = await self.make_request("POST", "/bookings", booking_data)
        
        if status2 != 200:
            self.results.add_result(test_name, False, f"Failed to create first booking: {response2}", {"status": status2})
            return False
        
        booking_id = response2["booking_id"]
        print(f"✅ First booking completed: {booking_id}")
        
        # Step 3: Try to create second hold for SAME time slot
        print(f"\n🔄 Attempting to create second hold for same time slot...")
        
        status3, response3 = await self.make_request("POST", "/booking-holds", hold_data)
        
        # This should return 409 Conflict
        if status3 == 409:
            self.results.add_result(test_name, True, 
                                  f"✅ DUPLICATE PREVENTION WORKING! Second hold correctly rejected with 409 Conflict: {response3.get('detail', 'Slot already booked')}")
            print(f"✅ Expected 409 response: {response3}")
            return True
        else:
            self.results.add_result(test_name, False, 
                                  f"❌ DUPLICATE PREVENTION FAILED! Expected 409 but got {status3}: {response3}")
            print(f"❌ Unexpected response - should be 409: Status {status3}, Response: {response3}")
            return False
    
    async def test_duplicate_booking_different_consumer(self):
        """Test duplicate booking prevention with different consumer"""
        test_name = "Duplicate Booking Prevention - Different Consumer"
        
        if not self.tutor_id:
            self.results.add_result(test_name, False, "No tutor ID available")
            return False
        
        # Register second consumer
        consumer2_email = f"testconsumer2_{uuid.uuid4().hex[:8]}@test.com"
        register_data = {
            "email": consumer2_email,
            "password": "TestPassword123!",
            "name": "Test Consumer 2",
            "role": "consumer"
        }
        
        status, response = await self.make_request("POST", "/auth/register", register_data)
        
        if status != 200:
            self.results.add_result(test_name, False, f"Failed to register second consumer: {response}")
            return False
        
        consumer2_token = response["token"]
        consumer2_user_id = response["user_id"]
        
        # Create student for second consumer
        temp_token = self.auth_token
        self.auth_token = consumer2_token
        
        student_data = {
            "name": "Test Student 2",
            "age": 10,
            "grade": "5th Grade"
        }
        
        status, response = await self.make_request("POST", "/students", student_data)
        
        if status != 200:
            self.auth_token = temp_token
            self.results.add_result(test_name, False, f"Failed to create student for consumer 2: {response}")
            return False
        
        student2_id = response["student_id"]
        
        # Try to book same time slot as different consumer
        future_time = datetime.now(timezone.utc) + timedelta(days=2, hours=14)  # Day after tomorrow at 2 PM
        
        hold_data = {
            "tutor_id": self.tutor_id,
            "start_at": future_time.isoformat(),
            "duration_minutes": 60
        }
        
        # Consumer 2 creates hold and booking
        status1, response1 = await self.make_request("POST", "/booking-holds", hold_data)
        
        if status1 == 200:
            booking_data = {
                "hold_id": response1["hold_id"],
                "student_id": student2_id,
                "intake": {
                    "goals": "Test booking",
                    "current_level": "Beginner",
                    "policy_acknowledged": True
                }
            }
            
            status2, response2 = await self.make_request("POST", "/bookings", booking_data)
            
            if status2 == 200:
                print(f"✅ Consumer 2 successfully booked slot at {future_time.isoformat()}")
                
                # Now consumer 1 tries to book same slot
                self.auth_token = temp_token
                
                status3, response3 = await self.make_request("POST", "/booking-holds", hold_data)
                
                if status3 == 409:
                    self.results.add_result(test_name, True, 
                                          f"✅ Cross-consumer duplicate prevention working! Got 409: {response3.get('detail')}")
                    return True
                else:
                    self.results.add_result(test_name, False, 
                                          f"❌ Cross-consumer duplicate prevention failed! Expected 409 but got {status3}: {response3}")
                    return False
        
        self.auth_token = temp_token
        self.results.add_result(test_name, False, "Failed to set up test scenario")
        return False
    
    async def run_all_tests(self):
        """Run all duplicate booking prevention tests"""
        print("=== MAESTRO HUB DUPLICATE BOOKING PREVENTION TESTING ===\n")
        
        # Authentication and setup
        if not await self.test_consumer_login():
            print("❌ Cannot proceed without authentication")
            return
        
        if not await self.test_get_tutors():
            print("❌ Cannot proceed without tutors")
            return
        
        if not await self.test_create_student():
            print("❌ Cannot proceed without student")
            return
        
        # Optional: Test tutor availability
        await self.test_get_tutor_availability()
        
        # Main duplicate booking prevention tests
        await self.test_duplicate_booking_prevention()
        await self.test_duplicate_booking_different_consumer()
        
        # Print summary
        passed, failed = self.results.summary()
        
        return passed, failed

async def main():
    """Main test runner"""
    async with MaestroHubTester() as tester:
        passed, failed = await tester.run_all_tests()
        
        if failed == 0:
            print(f"\n🎉 ALL TESTS PASSED! Duplicate booking prevention is working correctly.")
            exit(0)
        else:
            print(f"\n⚠️  {failed} test(s) failed. Please review the results above.")
            exit(1)

if __name__ == "__main__":
    asyncio.run(main())