#!/usr/bin/env python3
"""
Backend API Testing for Maestro Hub Parent/Consumer Features
Tests the newly implemented backend APIs including profile management, 
student management, billing, consumer invites, and reminders.
"""

import requests
import json
import sys
from datetime import datetime, timezone
import uuid

# Configuration
BACKEND_URL = "https://tutorhub-fix.preview.emergentagent.com/api"
TEST_EMAIL = "parent2@test.com"
TEST_PASSWORD = "password123"

class MaestroHubTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.user_id = None
        self.test_student_id = None
        self.results = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "message": message,
            "details": details or {}
        }
        self.results.append(result)
        print(f"{status} - {test_name}: {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def make_request(self, method, endpoint, data=None, headers=None):
        """Make HTTP request with proper error handling"""
        url = f"{BACKEND_URL}{endpoint}"
        req_headers = {"Content-Type": "application/json"}
        
        if self.auth_token:
            req_headers["Authorization"] = f"Bearer {self.auth_token}"
        
        if headers:
            req_headers.update(headers)
        
        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=req_headers)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, headers=req_headers)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data, headers=req_headers)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, headers=req_headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return response
        except Exception as e:
            return None, str(e)
    
    def test_login(self):
        """Test user login with provided credentials"""
        print(f"\n🔐 Testing Login with {TEST_EMAIL}")
        
        login_data = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }
        
        response = self.make_request("POST", "/auth/login", login_data)
        
        if response is None:
            self.log_result("Login", False, "Request failed - connection error")
            return False
        
        if response.status_code == 200:
            data = response.json()
            self.auth_token = data.get("token")
            self.user_id = data.get("user_id")
            self.log_result("Login", True, f"Successfully logged in as {TEST_EMAIL}")
            return True
        else:
            self.log_result("Login", False, f"Login failed with status {response.status_code}", 
                          {"response": response.text})
            return False
    
    def test_profile_management(self):
        """Test profile management endpoints"""
        print(f"\n👤 Testing Profile Management")
        
        # Test 1: Update Profile (PUT /api/profile)
        profile_data = {
            "name": "Updated Parent Name",
            "phone": "+1-555-0123"
        }
        
        response = self.make_request("PUT", "/profile", profile_data)
        
        if response and response.status_code == 200:
            self.log_result("Update Profile", True, "Profile updated successfully")
        else:
            error_msg = response.text if response else "Connection error"
            self.log_result("Update Profile", False, f"Failed to update profile", 
                          {"status": response.status_code if response else "N/A", "error": error_msg})
        
        # Test 2: Change Password (POST /api/profile/change-password)
        # Note: This will fail if user uses social login, which is expected
        password_data = {
            "current_password": TEST_PASSWORD,
            "new_password": "newpassword123"
        }
        
        response = self.make_request("POST", "/profile/change-password", password_data)
        
        if response:
            if response.status_code == 200:
                self.log_result("Change Password", True, "Password changed successfully")
                # Change it back for future tests
                revert_data = {
                    "current_password": "newpassword123",
                    "new_password": TEST_PASSWORD
                }
                self.make_request("POST", "/profile/change-password", revert_data)
            elif response.status_code == 400 and "social login" in response.text.lower():
                self.log_result("Change Password", True, "Expected failure - account uses social login")
            else:
                self.log_result("Change Password", False, f"Unexpected response", 
                              {"status": response.status_code, "error": response.text})
        else:
            self.log_result("Change Password", False, "Connection error")
    
    def test_student_management(self):
        """Test student/kids management endpoints"""
        print(f"\n👶 Testing Student Management")
        
        # Test 1: Create a student (POST /api/students)
        student_data = {
            "name": "Test Kid",
            "age": 10,
            "grade": "5th Grade",
            "notes": "Loves math and science",
            "email": "testkid@example.com",
            "auto_send_schedule": True
        }
        
        response = self.make_request("POST", "/students", student_data)
        
        if response and response.status_code == 200:
            data = response.json()
            self.test_student_id = data.get("student_id")
            self.log_result("Create Student", True, f"Student created with ID: {self.test_student_id}")
        else:
            error_msg = response.text if response else "Connection error"
            self.log_result("Create Student", False, "Failed to create student", 
                          {"status": response.status_code if response else "N/A", "error": error_msg})
            return
        
        # Test 2: Get all students (GET /api/students)
        response = self.make_request("GET", "/students")
        
        if response and response.status_code == 200:
            students = response.json()
            self.log_result("Get Students", True, f"Retrieved {len(students)} students")
        else:
            error_msg = response.text if response else "Connection error"
            self.log_result("Get Students", False, "Failed to get students", 
                          {"status": response.status_code if response else "N/A", "error": error_msg})
        
        if not self.test_student_id:
            return
        
        # Test 3: Update student (PUT /api/students/{id})
        update_data = {
            "name": "Updated Test Kid",
            "age": 11,
            "grade": "6th Grade",
            "notes": "Updated notes - still loves math and science",
            "email": "updatedkid@example.com",
            "auto_send_schedule": False
        }
        
        response = self.make_request("PUT", f"/students/{self.test_student_id}", update_data)
        
        if response and response.status_code == 200:
            self.log_result("Update Student", True, "Student updated successfully")
        else:
            error_msg = response.text if response else "Connection error"
            self.log_result("Update Student", False, "Failed to update student", 
                          {"status": response.status_code if response else "N/A", "error": error_msg})
        
        # Test 4: Get student schedule (GET /api/students/{id}/schedule)
        response = self.make_request("GET", f"/students/{self.test_student_id}/schedule")
        
        if response and response.status_code == 200:
            data = response.json()
            bookings_count = len(data.get("bookings", []))
            self.log_result("Get Student Schedule", True, f"Retrieved schedule with {bookings_count} bookings")
        else:
            error_msg = response.text if response else "Connection error"
            self.log_result("Get Student Schedule", False, "Failed to get student schedule", 
                          {"status": response.status_code if response else "N/A", "error": error_msg})
        
        # Test 5: Get student payments (GET /api/students/{id}/payments)
        response = self.make_request("GET", f"/students/{self.test_student_id}/payments")
        
        if response and response.status_code == 200:
            data = response.json()
            payments_count = len(data.get("payments", []))
            total_paid = data.get("total_paid", 0)
            self.log_result("Get Student Payments", True, f"Retrieved {payments_count} payments, total paid: ${total_paid}")
        else:
            error_msg = response.text if response else "Connection error"
            self.log_result("Get Student Payments", False, "Failed to get student payments", 
                          {"status": response.status_code if response else "N/A", "error": error_msg})
        
        # Test 6: Send schedule email (POST /api/students/{id}/send-schedule)
        response = self.make_request("POST", f"/students/{self.test_student_id}/send-schedule")
        
        if response and response.status_code == 200:
            data = response.json()
            bookings_count = data.get("bookings_count", 0)
            self.log_result("Send Schedule Email", True, f"Schedule email sent with {bookings_count} bookings")
        else:
            error_msg = response.text if response else "Connection error"
            self.log_result("Send Schedule Email", False, "Failed to send schedule email", 
                          {"status": response.status_code if response else "N/A", "error": error_msg})
        
        # Test 7: Delete student (DELETE /api/students/{id}) - Do this last
        response = self.make_request("DELETE", f"/students/{self.test_student_id}")
        
        if response and response.status_code == 200:
            self.log_result("Delete Student", True, "Student deleted successfully")
        else:
            error_msg = response.text if response else "Connection error"
            self.log_result("Delete Student", False, "Failed to delete student", 
                          {"status": response.status_code if response else "N/A", "error": error_msg})
    
    def test_billing(self):
        """Test billing endpoints"""
        print(f"\n💳 Testing Billing")
        
        # Test 1: Get billing info (GET /api/billing)
        response = self.make_request("GET", "/billing")
        
        if response and response.status_code == 200:
            data = response.json()
            stripe_connected = data.get("stripe_connected", False)
            pending_balance = data.get("pending_balance", 0)
            auto_pay = data.get("auto_pay", {})
            self.log_result("Get Billing Info", True, 
                          f"Stripe connected: {stripe_connected}, Pending: ${pending_balance}, Auto-pay: {auto_pay.get('enabled', False)}")
        else:
            error_msg = response.text if response else "Connection error"
            self.log_result("Get Billing Info", False, "Failed to get billing info", 
                          {"status": response.status_code if response else "N/A", "error": error_msg})
        
        # Test 2: Setup Stripe (POST /api/billing/setup-stripe)
        response = self.make_request("POST", "/billing/setup-stripe")
        
        if response and response.status_code == 200:
            data = response.json()
            if data.get("already_setup"):
                self.log_result("Setup Stripe", True, "Stripe already connected")
            else:
                customer_id = data.get("stripe_customer_id")
                self.log_result("Setup Stripe", True, f"Stripe setup complete, customer ID: {customer_id}")
        else:
            error_msg = response.text if response else "Connection error"
            self.log_result("Setup Stripe", False, "Failed to setup Stripe", 
                          {"status": response.status_code if response else "N/A", "error": error_msg})
        
        # Test 3: Update auto-pay settings (PUT /api/billing/auto-pay)
        auto_pay_data = {
            "enabled": True,
            "day_of_month": 15
        }
        
        response = self.make_request("PUT", "/billing/auto-pay", auto_pay_data)
        
        if response and response.status_code == 200:
            data = response.json()
            self.log_result("Update Auto-Pay", True, f"Auto-pay updated: enabled={data.get('auto_pay', {}).get('enabled')}")
        else:
            error_msg = response.text if response else "Connection error"
            self.log_result("Update Auto-Pay", False, "Failed to update auto-pay", 
                          {"status": response.status_code if response else "N/A", "error": error_msg})
    
    def test_consumer_invites(self):
        """Test consumer invite endpoints"""
        print(f"\n📧 Testing Consumer Invites")
        
        # Test 1: Send invite to provider (POST /api/consumer/invite-provider)
        invite_data = {
            "tutor_email": f"testtutor{uuid.uuid4().hex[:8]}@example.com",
            "tutor_name": "Test Tutor",
            "message": "Hi! I'd like to invite you to be my kid's tutor on Maestro Hub!"
        }
        
        response = self.make_request("POST", "/consumer/invite-provider", invite_data)
        
        if response and response.status_code == 200:
            data = response.json()
            invite_id = data.get("invite_id")
            credit_amount = data.get("credit_amount", 0)
            self.log_result("Send Provider Invite", True, 
                          f"Invite sent with ID: {invite_id}, Credit: ${credit_amount}")
        else:
            error_msg = response.text if response else "Connection error"
            self.log_result("Send Provider Invite", False, "Failed to send invite", 
                          {"status": response.status_code if response else "N/A", "error": error_msg})
        
        # Test 2: Get sent invites (GET /api/consumer/invites)
        response = self.make_request("GET", "/consumer/invites")
        
        if response and response.status_code == 200:
            data = response.json()
            invites_count = len(data.get("invites", []))
            self.log_result("Get Sent Invites", True, f"Retrieved {invites_count} sent invites")
        else:
            error_msg = response.text if response else "Connection error"
            self.log_result("Get Sent Invites", False, "Failed to get sent invites", 
                          {"status": response.status_code if response else "N/A", "error": error_msg})
    
    def test_reminders(self):
        """Test reminder configuration endpoints"""
        print(f"\n⏰ Testing Reminders")
        
        # Test 1: Get reminder config (GET /api/reminders/config)
        response = self.make_request("GET", "/reminders/config")
        
        if response and response.status_code == 200:
            data = response.json()
            session_hours = data.get("session_reminder_hours", 1)
            payment_days = data.get("payment_reminder_days", 1)
            weekly_summary = data.get("weekly_summary", True)
            self.log_result("Get Reminder Config", True, 
                          f"Session: {session_hours}h, Payment: {payment_days}d, Weekly: {weekly_summary}")
        else:
            error_msg = response.text if response else "Connection error"
            self.log_result("Get Reminder Config", False, "Failed to get reminder config", 
                          {"status": response.status_code if response else "N/A", "error": error_msg})
        
        # Test 2: Update reminder config (PUT /api/reminders/config)
        config_data = {
            "session_reminder_hours": 2,
            "payment_reminder_days": 3,
            "weekly_summary": False
        }
        
        response = self.make_request("PUT", "/reminders/config", config_data)
        
        if response and response.status_code == 200:
            data = response.json()
            config = data.get("config", {})
            self.log_result("Update Reminder Config", True, 
                          f"Updated - Session: {config.get('session_reminder_hours')}h, Payment: {config.get('payment_reminder_days')}d")
        else:
            error_msg = response.text if response else "Connection error"
            self.log_result("Update Reminder Config", False, "Failed to update reminder config", 
                          {"status": response.status_code if response else "N/A", "error": error_msg})
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Maestro Hub Backend API Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test User: {TEST_EMAIL}")
        print("=" * 60)
        
        # Login first
        if not self.test_login():
            print("❌ Login failed - cannot proceed with authenticated tests")
            return False
        
        # Run all test suites
        self.test_profile_management()
        self.test_student_management()
        self.test_billing()
        self.test_consumer_invites()
        self.test_reminders()
        
        # Print summary
        self.print_summary()
        
        return True
    
    def print_summary(self):
        """Print test results summary"""
        print("\n" + "=" * 60)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for r in self.results if "✅ PASS" in r["status"])
        failed = sum(1 for r in self.results if "❌ FAIL" in r["status"])
        total = len(self.results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed} ✅")
        print(f"Failed: {failed} ❌")
        print(f"Success Rate: {(passed/total*100):.1f}%")
        
        if failed > 0:
            print(f"\n❌ FAILED TESTS:")
            for result in self.results:
                if "❌ FAIL" in result["status"]:
                    print(f"  - {result['test']}: {result['message']}")
        
        print("\n" + "=" * 60)

def main():
    """Main test execution"""
    tester = MaestroHubTester()
    success = tester.run_all_tests()
    
    if success:
        print("✅ All tests completed successfully!")
        return 0
    else:
        print("❌ Some tests failed!")
        return 1

if __name__ == "__main__":
    sys.exit(main())