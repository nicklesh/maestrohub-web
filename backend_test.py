#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Maestro Habitat
Tests all critical API endpoints with fresh seeded data
"""

import requests
import json
import sys
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://learnhub-868.preview.emergentagent.com/api"
TEST_CREDENTIALS = {
    "parent": {"email": "parent1@test.com", "password": "password123"},
    "coach": {"email": "coach.math@test.com", "password": "password123"},
    "admin": {"email": "admin@maestrohub.com", "password": "password123"}
}

class APITester:
    def __init__(self):
        self.session = requests.Session()
        self.tokens = {}
        self.test_results = []
        self.failed_tests = []
        
    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        if response_data:
            result["response_sample"] = str(response_data)[:200] + "..." if len(str(response_data)) > 200 else response_data
            
        self.test_results.append(result)
        print(f"{status} - {test_name}")
        if details:
            print(f"    {details}")
        if not success:
            self.failed_tests.append(result)
    
    def make_request(self, method: str, endpoint: str, token: str = None, **kwargs) -> requests.Response:
        """Make HTTP request with optional authentication"""
        url = f"{BASE_URL}{endpoint}"
        headers = kwargs.get('headers', {})
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        kwargs['headers'] = headers
        
        try:
            response = self.session.request(method, url, **kwargs)
            return response
        except Exception as e:
            print(f"Request failed: {e}")
            raise
    
    def test_authentication(self):
        """Test authentication flows"""
        print("\n🔐 Testing Authentication Flows...")
        
        # Test login for each user type
        for user_type, creds in TEST_CREDENTIALS.items():
            try:
                response = self.make_request('POST', '/auth/login', json=creds)
                
                if response.status_code == 200:
                    data = response.json()
                    if 'token' in data and 'user_id' in data:
                        self.tokens[user_type] = data['token']
                        self.log_test(f"Login - {user_type}", True, 
                                    f"Role: {data.get('role')}, User ID: {data.get('user_id')}")
                    else:
                        self.log_test(f"Login - {user_type}", False, 
                                    f"Missing token or user_id in response: {data}")
                else:
                    self.log_test(f"Login - {user_type}", False, 
                                f"Status: {response.status_code}, Response: {response.text}")
            except Exception as e:
                self.log_test(f"Login - {user_type}", False, f"Exception: {str(e)}")
        
        # Test /auth/me for each authenticated user
        for user_type, token in self.tokens.items():
            try:
                response = self.make_request('GET', '/auth/me', token=token)
                
                if response.status_code == 200:
                    data = response.json()
                    required_fields = ['user_id', 'email', 'name', 'role']
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    if not missing_fields:
                        self.log_test(f"Auth Me - {user_type}", True, 
                                    f"User: {data.get('name')}, Role: {data.get('role')}")
                    else:
                        self.log_test(f"Auth Me - {user_type}", False, 
                                    f"Missing fields: {missing_fields}")
                else:
                    self.log_test(f"Auth Me - {user_type}", False, 
                                f"Status: {response.status_code}, Response: {response.text}")
            except Exception as e:
                self.log_test(f"Auth Me - {user_type}", False, f"Exception: {str(e)}")
        
        # Test token validation with invalid token
        try:
            # Clear any existing cookies to ensure clean test
            self.session.cookies.clear()
            response = self.make_request('GET', '/auth/me', token='invalid.token.here')
            if response.status_code == 401:
                self.log_test("Token Validation - Invalid Token", True, 
                            "Correctly rejected invalid token with 401")
            else:
                self.log_test("Token Validation - Invalid Token", False, 
                            f"Should return 401, got {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Token Validation - Invalid Token", False, f"Exception: {str(e)}")
    
    def test_categories(self):
        """Test categories API"""
        print("\n📚 Testing Categories API...")
        
        try:
            response = self.make_request('GET', '/categories')
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, dict) and 'categories' in data:
                    categories = data['categories']
                    if len(categories) >= 10:
                        # Check if categories have subcategories
                        has_subcategories = any('subcategories' in cat or 'subjects' in cat for cat in categories)
                        self.log_test("Categories API", True, 
                                    f"Found {len(categories)} categories, has subcategories: {has_subcategories}")
                    else:
                        self.log_test("Categories API", False, 
                                    f"Expected 10+ categories, got {len(categories)}")
                else:
                    self.log_test("Categories API", False, 
                                f"Unexpected response structure: {data}")
            else:
                self.log_test("Categories API", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Categories API", False, f"Exception: {str(e)}")
    
    def test_markets(self):
        """Test markets API"""
        print("\n🌍 Testing Markets API...")
        
        try:
            response = self.make_request('GET', '/markets')
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if response has 'markets' key with list of markets
                if isinstance(data, dict) and 'markets' in data:
                    markets = data['markets']
                    if len(markets) >= 2:
                        market_ids = [market.get('market_id') for market in markets]
                        expected_markets = ['US_USD', 'IN_INR']
                        
                        if all(market in market_ids for market in expected_markets):
                            self.log_test("Markets API", True, 
                                        f"Found expected markets: {market_ids}")
                        else:
                            self.log_test("Markets API", False, 
                                        f"Missing expected markets. Found: {market_ids}")
                    else:
                        self.log_test("Markets API", False, 
                                    f"Expected 2+ markets, got {len(markets)}")
                else:
                    self.log_test("Markets API", False, 
                                f"Expected dict with 'markets' key, got: {type(data)}")
            else:
                self.log_test("Markets API", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Markets API", False, f"Exception: {str(e)}")
    
    def test_tutor_search(self):
        """Test tutor search APIs"""
        print("\n🔍 Testing Tutor Search APIs...")
        
        # Test general tutor search
        try:
            response = self.make_request('GET', '/tutors/search')
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, dict) and 'tutors' in data:
                    tutors = data['tutors']
                    self.log_test("Tutor Search - General", True, 
                                f"Found {len(tutors)} tutors")
                    
                    # Check tutor data structure
                    if tutors:
                        tutor = tutors[0]
                        required_fields = ['tutor_id', 'name', 'bio', 'subjects', 'base_price']
                        missing_fields = [field for field in required_fields if field not in tutor]
                        
                        if not missing_fields:
                            self.log_test("Tutor Data Structure", True, 
                                        f"All required fields present")
                        else:
                            self.log_test("Tutor Data Structure", False, 
                                        f"Missing fields: {missing_fields}")
                        
                        # Check for known issue fields
                        optional_fields = ['cancel_window_hours', 'booking_policy', 'policies']
                        missing_optional = [field for field in optional_fields if field not in tutor]
                        if missing_optional:
                            self.log_test("Tutor Optional Fields", True, 
                                        f"Note: Missing optional fields: {missing_optional} (this is expected)")
                        else:
                            self.log_test("Tutor Optional Fields", True, 
                                        "All optional fields present")
                else:
                    self.log_test("Tutor Search - General", False, 
                                f"Unexpected response structure: {data}")
            else:
                self.log_test("Tutor Search - General", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Tutor Search - General", False, f"Exception: {str(e)}")
        
        # Test category filtering
        try:
            response = self.make_request('GET', '/tutors/search?category=academics')
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, dict) and 'tutors' in data:
                    tutors = data['tutors']
                    self.log_test("Tutor Search - Category Filter", True, 
                                f"Category filter returned {len(tutors)} tutors")
                else:
                    self.log_test("Tutor Search - Category Filter", False, 
                                f"Unexpected response structure: {data}")
            else:
                self.log_test("Tutor Search - Category Filter", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Tutor Search - Category Filter", False, f"Exception: {str(e)}")
    
    def test_tutor_details(self):
        """Test tutor details API"""
        print("\n👨‍🏫 Testing Tutor Details API...")
        
        # First get a tutor ID from search
        try:
            search_response = self.make_request('GET', '/tutors/search')
            if search_response.status_code == 200:
                search_data = search_response.json()
                tutors = search_data.get('tutors', [])
                
                if tutors:
                    tutor_id = tutors[0].get('tutor_id')
                    
                    # Test tutor details endpoint
                    response = self.make_request('GET', f'/tutors/{tutor_id}')
                    
                    if response.status_code == 200:
                        data = response.json()
                        
                        required_fields = ['tutor_id', 'name', 'bio', 'subjects', 'base_price']
                        missing_fields = [field for field in required_fields if field not in data]
                        
                        if not missing_fields:
                            self.log_test("Tutor Details", True, 
                                        f"Tutor details for {data.get('name')}")
                        else:
                            self.log_test("Tutor Details", False, 
                                        f"Missing fields: {missing_fields}")
                    else:
                        self.log_test("Tutor Details", False, 
                                    f"Status: {response.status_code}, Response: {response.text}")
                else:
                    self.log_test("Tutor Details", False, "No tutors found to test details")
            else:
                self.log_test("Tutor Details", False, "Could not get tutors for details test")
        except Exception as e:
            self.log_test("Tutor Details", False, f"Exception: {str(e)}")
    
    def test_availability(self):
        """Test tutor availability API"""
        print("\n📅 Testing Tutor Availability API...")
        
        # First get a tutor ID from search
        try:
            search_response = self.make_request('GET', '/tutors/search')
            if search_response.status_code == 200:
                search_data = search_response.json()
                tutors = search_data.get('tutors', [])
                
                if tutors:
                    tutor_id = tutors[0].get('tutor_id')
                    test_date = "2026-01-27"
                    
                    # Test availability endpoint
                    response = self.make_request('GET', f'/tutors/{tutor_id}/availability?date={test_date}')
                    
                    if response.status_code == 200:
                        data = response.json()
                        
                        if isinstance(data, dict):
                            self.log_test("Tutor Availability", True, 
                                        f"Availability data returned for {test_date}")
                        else:
                            self.log_test("Tutor Availability", False, 
                                        f"Unexpected response structure: {data}")
                    else:
                        self.log_test("Tutor Availability", False, 
                                    f"Status: {response.status_code}, Response: {response.text}")
                else:
                    self.log_test("Tutor Availability", False, "No tutors found to test availability")
            else:
                self.log_test("Tutor Availability", False, "Could not get tutors for availability test")
        except Exception as e:
            self.log_test("Tutor Availability", False, f"Exception: {str(e)}")
    
    def test_students(self):
        """Test students/kids API"""
        print("\n👶 Testing Students/Kids API...")
        
        parent_token = self.tokens.get('parent')
        if not parent_token:
            self.log_test("Students API", False, "No parent token available")
            return
        
        # Test GET students
        try:
            response = self.make_request('GET', '/students', token=parent_token)
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list):
                    self.log_test("Get Students", True, 
                                f"Found {len(data)} students")
                else:
                    self.log_test("Get Students", False, 
                                f"Expected list, got: {type(data)}")
            else:
                self.log_test("Get Students", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Get Students", False, f"Exception: {str(e)}")
        
        # Test POST students (create new student)
        try:
            student_data = {
                "name": "Test Student",
                "age": 12,
                "grade": "7th",
                "notes": "Test student for API testing"
            }
            
            response = self.make_request('POST', '/students', token=parent_token, json=student_data)
            
            if response.status_code == 200 or response.status_code == 201:
                data = response.json()
                
                if 'student_id' in data:
                    self.log_test("Create Student", True, 
                                f"Created student with ID: {data.get('student_id')}")
                else:
                    self.log_test("Create Student", False, 
                                f"Missing student_id in response: {data}")
            else:
                self.log_test("Create Student", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Create Student", False, f"Exception: {str(e)}")
    
    def test_booking_flow(self):
        """Test booking related endpoints"""
        print("\n📝 Testing Booking Flow APIs...")
        
        parent_token = self.tokens.get('parent')
        if not parent_token:
            self.log_test("Booking Flow", False, "No parent token available")
            return
        
        # Test booking holds endpoint
        try:
            # First get a tutor for booking
            search_response = self.make_request('GET', '/tutors/search')
            if search_response.status_code == 200:
                tutors = search_response.json().get('tutors', [])
                
                if tutors:
                    tutor_id = tutors[0].get('tutor_id')
                    
                    # Create booking hold
                    hold_data = {
                        "tutor_id": tutor_id,
                        "start_at": (datetime.now() + timedelta(days=1)).isoformat(),
                        "duration_minutes": 60
                    }
                    
                    response = self.make_request('POST', '/booking-holds', token=parent_token, json=hold_data)
                    
                    if response.status_code == 200 or response.status_code == 201:
                        data = response.json()
                        
                        if 'hold_id' in data:
                            self.log_test("Create Booking Hold", True, 
                                        f"Created hold with ID: {data.get('hold_id')}")
                        else:
                            self.log_test("Create Booking Hold", False, 
                                        f"Missing hold_id in response: {data}")
                    else:
                        self.log_test("Create Booking Hold", False, 
                                    f"Status: {response.status_code}, Response: {response.text}")
                else:
                    self.log_test("Create Booking Hold", False, "No tutors available for booking test")
            else:
                self.log_test("Create Booking Hold", False, "Could not get tutors for booking test")
        except Exception as e:
            self.log_test("Create Booking Hold", False, f"Exception: {str(e)}")
    
    def test_notifications(self):
        """Test notifications API"""
        print("\n🔔 Testing Notifications API...")
        
        for user_type, token in self.tokens.items():
            try:
                response = self.make_request('GET', '/notifications', token=token)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Check if response has 'notifications' key with list
                    if isinstance(data, dict) and 'notifications' in data:
                        notifications = data['notifications']
                        if isinstance(notifications, list):
                            self.log_test(f"Notifications - {user_type}", True, 
                                        f"Found {len(notifications)} notifications, unread: {data.get('unread_count', 0)}")
                        else:
                            self.log_test(f"Notifications - {user_type}", False, 
                                        f"Expected list in 'notifications' key, got: {type(notifications)}")
                    else:
                        self.log_test(f"Notifications - {user_type}", False, 
                                    f"Expected dict with 'notifications' key, got: {type(data)}")
                else:
                    self.log_test(f"Notifications - {user_type}", False, 
                                f"Status: {response.status_code}, Response: {response.text}")
            except Exception as e:
                self.log_test(f"Notifications - {user_type}", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting Comprehensive Backend API Testing for Maestro Habitat")
        print(f"Base URL: {BASE_URL}")
        print("=" * 80)
        
        # Run all test suites
        self.test_authentication()
        self.test_categories()
        self.test_markets()
        self.test_tutor_search()
        self.test_tutor_details()
        self.test_availability()
        self.test_students()
        self.test_booking_flow()
        self.test_notifications()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 80)
        print("📊 TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = len([t for t in self.test_results if t['success']])
        failed_tests = len(self.failed_tests)
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if self.failed_tests:
            print("\n🚨 FAILED TESTS:")
            for test in self.failed_tests:
                print(f"  ❌ {test['test']}: {test['details']}")
        
        print("\n📋 DETAILED RESULTS:")
        for test in self.test_results:
            print(f"  {test['status']} {test['test']}")
            if test['details']:
                print(f"      {test['details']}")
        
        # Save results to file
        with open('/app/test_results_detailed.json', 'w') as f:
            json.dump({
                'summary': {
                    'total_tests': total_tests,
                    'passed': passed_tests,
                    'failed': failed_tests,
                    'success_rate': f"{(passed_tests/total_tests)*100:.1f}%"
                },
                'failed_tests': self.failed_tests,
                'all_results': self.test_results
            }, f, indent=2)
        
        print(f"\n💾 Detailed results saved to: /app/test_results_detailed.json")

if __name__ == "__main__":
    tester = APITester()
    tester.run_all_tests()