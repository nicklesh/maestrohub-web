#!/usr/bin/env python3
"""
Backend API Testing for Maestro Habitat
Testing specific bug fixes:
1. Cancel Booking API
2. User Conflict Detection in Availability
"""

import asyncio
import httpx
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional

# Get backend URL from environment
BACKEND_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://easydeploy-2.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

# Test credentials from review request
TEST_CREDENTIALS = {
    "parent1": {"email": "parent1@test.com", "password": "password123"},
    "tutor_sarah": "tutor_9aeb9e5481f3e438fb0124dd",  # Sarah Johnson
    "tutor_michael": "tutor_e895a0daa5e30f9c3d2dfa6e"  # Michael Chen
}

class BackendTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.auth_token = None
        self.user_id = None
        self.test_results = []
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
    
    def log_result(self, test_name: str, success: bool, message: str, details: Dict = None):
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
    
    async def login(self, email: str, password: str) -> bool:
        """Login and get auth token"""
        try:
            response = await self.client.post(f"{API_BASE}/auth/login", json={
                "email": email,
                "password": password
            })
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("token")
                self.user_id = data.get("user_id")
                self.log_result("Login", True, f"Successfully logged in as {email}", {
                    "user_id": self.user_id,
                    "role": data.get("role")
                })
                return True
            else:
                self.log_result("Login", False, f"Login failed: {response.status_code}", {
                    "response": response.text
                })
                return False
                
        except Exception as e:
            self.log_result("Login", False, f"Login error: {str(e)}")
            return False
    
    def get_auth_headers(self) -> Dict[str, str]:
        """Get authorization headers"""
        if not self.auth_token:
            return {}
        return {"Authorization": f"Bearer {self.auth_token}"}
    
    async def get_bookings(self) -> Optional[list]:
        """Get user's bookings"""
        try:
            response = await self.client.get(
                f"{API_BASE}/bookings",
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                bookings = response.json()  # API returns direct array
                if isinstance(bookings, list):
                    self.log_result("Get Bookings", True, f"Retrieved {len(bookings)} bookings")
                    return bookings
                else:
                    # Fallback for object format
                    bookings = bookings.get("bookings", [])
                    self.log_result("Get Bookings", True, f"Retrieved {len(bookings)} bookings")
                    return bookings
            else:
                self.log_result("Get Bookings", False, f"Failed to get bookings: {response.status_code}", {
                    "response": response.text
                })
                return None
                
        except Exception as e:
            self.log_result("Get Bookings", False, f"Error getting bookings: {str(e)}")
            return None
    
    async def test_cancel_booking(self) -> bool:
        """Test the cancel booking API endpoint"""
        print("\n🔧 Testing Cancel Booking API...")
        
        # First get user's bookings
        bookings = await self.get_bookings()
        if not bookings:
            self.log_result("Cancel Booking Test", False, "No bookings found to test cancellation")
            return False
        
        # Find a booking that can be canceled (status: booked or confirmed)
        cancelable_booking = None
        for booking in bookings:
            if booking.get("status") in ["booked", "confirmed"]:
                cancelable_booking = booking
                break
        
        if not cancelable_booking:
            self.log_result("Cancel Booking Test", False, "No cancelable bookings found (need status: booked/confirmed)")
            return False
        
        booking_id = cancelable_booking.get("booking_id")
        original_status = cancelable_booking.get("status")
        
        try:
            # Test the cancel booking endpoint
            response = await self.client.post(
                f"{API_BASE}/bookings/{booking_id}/cancel",
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                new_status = data.get("status")
                
                # Verify the booking was actually canceled
                updated_bookings = await self.get_bookings()
                if updated_bookings:
                    updated_booking = next((b for b in updated_bookings if b.get("booking_id") == booking_id), None)
                    if updated_booking and "canceled" in updated_booking.get("status", ""):
                        self.log_result("Cancel Booking API", True, f"Successfully canceled booking {booking_id}", {
                            "booking_id": booking_id,
                            "original_status": original_status,
                            "new_status": updated_booking.get("status"),
                            "response": data
                        })
                        return True
                    else:
                        self.log_result("Cancel Booking API", False, "Booking status not updated in database", {
                            "booking_id": booking_id,
                            "expected_status_contains": "canceled",
                            "actual_status": updated_booking.get("status") if updated_booking else "booking_not_found"
                        })
                        return False
                else:
                    self.log_result("Cancel Booking API", False, "Could not verify booking cancellation - failed to retrieve updated bookings")
                    return False
            else:
                self.log_result("Cancel Booking API", False, f"Cancel request failed: {response.status_code}", {
                    "booking_id": booking_id,
                    "response": response.text
                })
                return False
                
        except Exception as e:
            self.log_result("Cancel Booking API", False, f"Error testing cancel booking: {str(e)}")
            return False
    
    async def create_test_booking(self, tutor_id: str, start_time: datetime) -> Optional[str]:
        """Create a test booking for conflict testing"""
        try:
            # First create a booking hold
            hold_response = await self.client.post(
                f"{API_BASE}/booking-holds",
                headers=self.get_auth_headers(),
                json={
                    "tutor_id": tutor_id,
                    "start_at": start_time.isoformat(),
                    "duration_minutes": 60
                }
            )
            
            if hold_response.status_code != 200:
                self.log_result("Create Test Booking Hold", False, f"Failed to create hold: {hold_response.status_code}")
                return None
            
            hold_data = hold_response.json()
            hold_id = hold_data.get("hold_id")
            
            # Get user's students for booking
            students_response = await self.client.get(
                f"{API_BASE}/students",
                headers=self.get_auth_headers()
            )
            
            if students_response.status_code != 200:
                self.log_result("Create Test Booking", False, "Failed to get students for booking")
                return None
            
            students = students_response.json()  # API returns direct array
            if not isinstance(students, list):
                # Fallback for object format
                students = students_response.json().get("students", [])
            
            if not students:
                # Create a test student
                student_response = await self.client.post(
                    f"{API_BASE}/students",
                    headers=self.get_auth_headers(),
                    json={
                        "name": "Test Student",
                        "age": 12,
                        "grade": "7th"
                    }
                )
                if student_response.status_code == 200:
                    students = [student_response.json()]
                else:
                    self.log_result("Create Test Booking", False, "Failed to create test student")
                    return None
            
            student_id = students[0].get("student_id")
            
            # Create the actual booking
            booking_response = await self.client.post(
                f"{API_BASE}/bookings",
                headers=self.get_auth_headers(),
                json={
                    "hold_id": hold_id,
                    "student_id": student_id,
                    "intake": {
                        "goals": "Test booking for conflict detection",
                        "current_level": "Intermediate",
                        "policy_acknowledged": True
                    }
                }
            )
            
            if booking_response.status_code == 200:
                booking_data = booking_response.json()
                booking_id = booking_data.get("booking_id")
                self.log_result("Create Test Booking", True, f"Created test booking {booking_id}")
                return booking_id
            else:
                self.log_result("Create Test Booking", False, f"Failed to create booking: {booking_response.status_code}")
                return None
                
        except Exception as e:
            self.log_result("Create Test Booking", False, f"Error creating test booking: {str(e)}")
            return None
    
    async def test_user_conflict_detection(self) -> bool:
        """Test user conflict detection in availability endpoint"""
        print("\n🔧 Testing User Conflict Detection in Availability...")
        
        # Test date - use a future date to ensure it's available
        test_date = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
        test_datetime = datetime.now() + timedelta(days=3, hours=10)  # 10 AM in 3 days
        
        tutor_sarah = TEST_CREDENTIALS["tutor_sarah"]
        tutor_michael = TEST_CREDENTIALS["tutor_michael"]
        
        # Step 1: Try to create a booking with Sarah at a specific time
        print(f"Attempting to create test booking with tutor {tutor_sarah} at {test_datetime}")
        booking_id = await self.create_test_booking(tutor_sarah, test_datetime)
        
        # Step 2: Test availability endpoint with and without auth regardless of booking creation
        try:
            # Check availability for Michael WITH auth token
            response_with_auth = await self.client.get(
                f"{API_BASE}/tutors/{tutor_michael}/availability",
                headers=self.get_auth_headers(),
                params={"date": test_date}
            )
            
            if response_with_auth.status_code != 200:
                self.log_result("User Conflict Detection", False, f"Failed to get availability with auth: {response_with_auth.status_code}")
                return False
            
            auth_data = response_with_auth.json()
            auth_slots = auth_data.get("slots", [])
            
            # Check availability for Michael WITHOUT auth token
            response_without_auth = await self.client.get(
                f"{API_BASE}/tutors/{tutor_michael}/availability",
                params={"date": test_date}
            )
            
            if response_without_auth.status_code != 200:
                self.log_result("User Conflict Detection", False, f"Failed to get availability without auth: {response_without_auth.status_code}")
                return False
            
            no_auth_data = response_without_auth.json()
            no_auth_slots = no_auth_data.get("slots", [])
            
            # Step 3: Analyze the availability responses
            # Check if has_user_conflict field is present in authenticated response
            auth_slots_with_conflict_field = [slot for slot in auth_slots if "has_user_conflict" in slot]
            no_auth_slots_with_conflict_field = [slot for slot in no_auth_slots if "has_user_conflict" in slot]
            
            # Check for actual conflicts (has_user_conflict=true)
            conflict_slots_with_auth = [slot for slot in auth_slots if slot.get("has_user_conflict")]
            conflict_slots_without_auth = [slot for slot in no_auth_slots if slot.get("has_user_conflict")]
            
            # Test 1: Verify has_user_conflict field is present when authenticated
            has_conflict_field_with_auth = len(auth_slots_with_conflict_field) > 0
            has_conflict_field_without_auth = len(no_auth_slots_with_conflict_field) > 0
            
            # Test 2: If we successfully created a booking, check for conflicts
            if booking_id:
                # Find slots that overlap with our test booking time
                test_start = test_datetime.replace(second=0, microsecond=0)
                test_end = test_start + timedelta(hours=1)
                
                overlapping_slots_with_auth = []
                for slot in auth_slots:
                    try:
                        slot_start = datetime.fromisoformat(slot["start_at"].replace("Z", "+00:00")).replace(tzinfo=None)
                        slot_end = datetime.fromisoformat(slot["end_at"].replace("Z", "+00:00")).replace(tzinfo=None)
                        
                        if (slot_start < test_end and slot_end > test_start):
                            overlapping_slots_with_auth.append(slot)
                    except:
                        continue
                
                has_conflict_at_booking_time = any(slot.get("has_user_conflict") for slot in overlapping_slots_with_auth)
                
                success = (has_conflict_field_with_auth and 
                          not has_conflict_field_without_auth and 
                          has_conflict_at_booking_time)
                
                self.log_result("User Conflict Detection", success, 
                    "Conflict detection working correctly with booking" if success else "Conflict detection issues found", {
                    "booking_created": True,
                    "booking_id": booking_id,
                    "test_booking_time": test_datetime.isoformat(),
                    "tutor_with_booking": tutor_sarah,
                    "tutor_checked": tutor_michael,
                    "has_conflict_field_with_auth": has_conflict_field_with_auth,
                    "has_conflict_field_without_auth": has_conflict_field_without_auth,
                    "conflict_detected_at_booking_time": has_conflict_at_booking_time,
                    "total_auth_slots": len(auth_slots),
                    "total_no_auth_slots": len(no_auth_slots),
                    "overlapping_slots_count": len(overlapping_slots_with_auth)
                })
            else:
                # Even without a booking, test the basic functionality
                success = has_conflict_field_with_auth and not has_conflict_field_without_auth
                
                self.log_result("User Conflict Detection", success, 
                    "Basic conflict detection field working" if success else "Conflict detection field issues", {
                    "booking_created": False,
                    "test_date": test_date,
                    "tutor_checked": tutor_michael,
                    "has_conflict_field_with_auth": has_conflict_field_with_auth,
                    "has_conflict_field_without_auth": has_conflict_field_without_auth,
                    "total_auth_slots": len(auth_slots),
                    "total_no_auth_slots": len(no_auth_slots),
                    "auth_slots_with_conflict_field": len(auth_slots_with_conflict_field),
                    "no_auth_slots_with_conflict_field": len(no_auth_slots_with_conflict_field)
                })
            
            return success
            
        except Exception as e:
            self.log_result("User Conflict Detection", False, f"Error testing conflict detection: {str(e)}")
            return False
    
    async def run_all_tests(self):
        """Run all bug fix tests"""
        print("🚀 Starting Backend Bug Fix Testing...")
        print(f"Backend URL: {API_BASE}")
        
        # Login as parent1
        login_success = await self.login(
            TEST_CREDENTIALS["parent1"]["email"],
            TEST_CREDENTIALS["parent1"]["password"]
        )
        
        if not login_success:
            print("❌ Cannot proceed without authentication")
            return
        
        # Test 1: Cancel Booking API
        await self.test_cancel_booking()
        
        # Test 2: User Conflict Detection
        await self.test_user_conflict_detection()
        
        # Summary
        print("\n📊 TEST SUMMARY")
        print("=" * 50)
        
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r["success"]])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['message']}")
        
        return passed_tests, failed_tests

async def main():
    """Main test runner"""
    async with BackendTester() as tester:
        await tester.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())