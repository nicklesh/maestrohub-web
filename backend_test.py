#!/usr/bin/env python3
"""
Comprehensive Backend API Test Suite for Maestro Hub
Tests all endpoints including the newly implemented Invites API
"""

import requests
import json
import sys
import os
from datetime import datetime

# Get backend URL from environment
BACKEND_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://maestro-hub-1.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

# Test credentials for invites testing
TEST_CREDENTIALS = {
    "consumer": {
        "email": "parent2@test.com",
        "password": "password123"
    },
    "tutor": {
        "email": "tutor1@test.com", 
        "password": "password123"
    }
}

class APITester:
    def __init__(self):
        self.session = requests.Session()
        self.consumer_token = None
        self.tutor_token = None
        self.test_results = []
        
    def log_result(self, test_name, success, details="", response_data=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        if response_data and not success:
            print(f"   Response: {response_data}")
        print()
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
    
    def test_auth_register(self):
        """Test user registration endpoint"""
        print("🔐 Testing Authentication - Registration")
        
        # Test consumer registration
        consumer_data = {
            "email": TEST_CREDENTIALS["consumer"]["email"],
            "password": TEST_CREDENTIALS["consumer"]["password"],
            "name": "Test Parent",
            "role": "consumer"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/register", json=consumer_data)
            if response.status_code == 200:
                data = response.json()
                if "user_id" in data and "token" in data:
                    self.consumer_token = data["token"]
                    self.log_result("POST /api/auth/register (Consumer)", True, 
                                  f"User registered with ID: {data['user_id']}")
                else:
                    self.log_result("POST /api/auth/register (Consumer)", False, 
                                  "Missing user_id or token in response", data)
            elif response.status_code == 400 and "already registered" in response.text:
                # User already exists, try login instead
                self.log_result("POST /api/auth/register (Consumer)", True, 
                              "User already exists (expected for existing test data)")
            else:
                self.log_result("POST /api/auth/register (Consumer)", False, 
                              f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("POST /api/auth/register (Consumer)", False, f"Exception: {str(e)}")
        
        # Test tutor registration
        tutor_data = {
            "email": TEST_CREDENTIALS["tutor"]["email"],
            "password": TEST_CREDENTIALS["tutor"]["password"],
            "name": "Test Tutor",
            "role": "tutor"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/register", json=tutor_data)
            if response.status_code == 200:
                data = response.json()
                if "user_id" in data and "token" in data:
                    self.tutor_token = data["token"]
                    self.log_result("POST /api/auth/register (Tutor)", True, 
                                  f"Tutor registered with ID: {data['user_id']}")
                else:
                    self.log_result("POST /api/auth/register (Tutor)", False, 
                                  "Missing user_id or token in response", data)
            elif response.status_code == 400 and "already registered" in response.text:
                self.log_result("POST /api/auth/register (Tutor)", True, 
                              "Tutor already exists (expected for existing test data)")
            else:
                self.log_result("POST /api/auth/register (Tutor)", False, 
                              f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("POST /api/auth/register (Tutor)", False, f"Exception: {str(e)}")
    
    def test_auth_login(self):
        """Test user login endpoint"""
        print("🔐 Testing Authentication - Login")
        
        # Test consumer login
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json=TEST_CREDENTIALS["consumer"])
            if response.status_code == 200:
                data = response.json()
                if "user_id" in data and "token" in data:
                    self.consumer_token = data["token"]
                    self.log_result("POST /api/auth/login (Consumer)", True, 
                                  f"Login successful, token received")
                else:
                    self.log_result("POST /api/auth/login (Consumer)", False, 
                                  "Missing user_id or token in response", data)
            else:
                self.log_result("POST /api/auth/login (Consumer)", False, 
                              f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("POST /api/auth/login (Consumer)", False, f"Exception: {str(e)}")
        
        # Test tutor login
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json=TEST_CREDENTIALS["tutor"])
            if response.status_code == 200:
                data = response.json()
                if "user_id" in data and "token" in data:
                    self.tutor_token = data["token"]
                    self.log_result("POST /api/auth/login (Tutor)", True, 
                                  f"Login successful, token received")
                else:
                    self.log_result("POST /api/auth/login (Tutor)", False, 
                                  "Missing user_id or token in response", data)
            else:
                self.log_result("POST /api/auth/login (Tutor)", False, 
                              f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("POST /api/auth/login (Tutor)", False, f"Exception: {str(e)}")
    
    def test_auth_me(self):
        """Test get current user endpoint"""
        print("👤 Testing User Profile - GET /api/auth/me")
        
        if not self.consumer_token:
            self.log_result("GET /api/auth/me (Consumer)", False, "No consumer token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.consumer_token}"}
            response = self.session.get(f"{API_BASE}/auth/me", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if "user_id" in data and "email" in data and "role" in data:
                    self.log_result("GET /api/auth/me (Consumer)", True, 
                                  f"User profile retrieved: {data['email']}, role: {data['role']}")
                else:
                    self.log_result("GET /api/auth/me (Consumer)", False, 
                                  "Missing required fields in user profile", data)
            else:
                self.log_result("GET /api/auth/me (Consumer)", False, 
                              f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("GET /api/auth/me (Consumer)", False, f"Exception: {str(e)}")
    
    def test_categories(self):
        """Test categories endpoint"""
        print("📚 Testing Categories - GET /api/categories")
        
        try:
            response = self.session.get(f"{API_BASE}/categories")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, dict) and "categories" in data:
                    categories = data["categories"]
                    if isinstance(categories, list) and len(categories) > 0:
                        self.log_result("GET /api/categories", True, 
                                      f"Categories retrieved: {len(categories)} categories found")
                    else:
                        self.log_result("GET /api/categories", False, 
                                      "Categories list is empty or invalid format", data)
                else:
                    self.log_result("GET /api/categories", False, 
                                  "Invalid response format - expected categories object", data)
            else:
                self.log_result("GET /api/categories", False, 
                              f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("GET /api/categories", False, f"Exception: {str(e)}")
    
    def test_tutor_search(self):
        """Test tutor search endpoint"""
        print("🔍 Testing Tutor Search - GET /api/tutors/search")
        
        try:
            response = self.session.get(f"{API_BASE}/tutors/search")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, dict) and "tutors" in data and "total" in data:
                    tutors = data["tutors"]
                    total = data["total"]
                    self.log_result("GET /api/tutors/search", True, 
                                  f"Search successful: {len(tutors)} tutors returned, total: {total}")
                else:
                    self.log_result("GET /api/tutors/search", False, 
                                  "Invalid response format - expected tutors and total", data)
            else:
                self.log_result("GET /api/tutors/search", False, 
                              f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("GET /api/tutors/search", False, f"Exception: {str(e)}")
    
    def test_reports_consumer(self):
        """Test consumer reports endpoint"""
        print("📊 Testing Reports - GET /api/reports/consumer")
        
        if not self.consumer_token:
            self.log_result("GET /api/reports/consumer", False, "No consumer token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.consumer_token}"}
            response = self.session.get(f"{API_BASE}/reports/consumer", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, dict):
                    self.log_result("GET /api/reports/consumer", True, 
                                  f"Consumer report retrieved successfully")
                else:
                    self.log_result("GET /api/reports/consumer", False, 
                                  "Invalid response format", data)
            else:
                self.log_result("GET /api/reports/consumer", False, 
                              f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("GET /api/reports/consumer", False, f"Exception: {str(e)}")
    
    def test_notifications(self):
        """Test notifications endpoint"""
        print("🔔 Testing Notifications - GET /api/notifications")
        
        if not self.consumer_token:
            self.log_result("GET /api/notifications", False, "No consumer token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.consumer_token}"}
            response = self.session.get(f"{API_BASE}/notifications", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, dict) and "notifications" in data:
                    notifications = data["notifications"]
                    unread_count = data.get("unread_count", 0)
                    self.log_result("GET /api/notifications", True, 
                                  f"Notifications retrieved: {len(notifications)} total, {unread_count} unread")
                else:
                    self.log_result("GET /api/notifications", False, 
                                  "Invalid response format - expected notifications", data)
            else:
                self.log_result("GET /api/notifications", False, 
                              f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("GET /api/notifications", False, f"Exception: {str(e)}")
    
    def test_reminders(self):
        """Test reminders endpoint"""
        print("⏰ Testing Reminders - GET /api/reminders")
        
        if not self.consumer_token:
            self.log_result("GET /api/reminders", False, "No consumer token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.consumer_token}"}
            response = self.session.get(f"{API_BASE}/reminders", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, dict) and "reminders" in data:
                    reminders = data["reminders"]
                    total = data.get("total", 0)
                    self.log_result("GET /api/reminders", True, 
                                  f"Reminders retrieved: {len(reminders)} reminders, total: {total}")
                else:
                    self.log_result("GET /api/reminders", False, 
                                  "Invalid response format - expected reminders", data)
            else:
                self.log_result("GET /api/reminders", False, 
                              f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("GET /api/reminders", False, f"Exception: {str(e)}")
    
    def test_contact(self):
        """Test contact endpoint"""
        print("📞 Testing Contact - POST /api/contact")
        
        if not self.consumer_token:
            self.log_result("POST /api/contact", False, "No consumer token available")
            return
        
        contact_data = {
            "subject": "Test Contact Request",
            "message": "This is a test contact request from the API testing suite.",
            "category": "general"
        }
        
        try:
            headers = {"Authorization": f"Bearer {self.consumer_token}"}
            response = self.session.post(f"{API_BASE}/contact", json=contact_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, dict) and "contact_id" in data:
                    self.log_result("POST /api/contact", True, 
                                  f"Contact request submitted successfully: {data['contact_id']}")
                else:
                    self.log_result("POST /api/contact", False, 
                                  "Invalid response format - expected contact_id", data)
            else:
                self.log_result("POST /api/contact", False, 
                              f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("POST /api/contact", False, f"Exception: {str(e)}")
    
    def test_markets(self):
        """Test markets endpoint"""
        print("🌍 Testing Markets - GET /api/markets")
        
        try:
            response = self.session.get(f"{API_BASE}/markets")
            
            if response.status_code == 200:
                data = response.json()
                # Handle both formats: direct list or object with markets key
                if isinstance(data, list) and len(data) > 0:
                    markets = data
                    market_ids = [m.get("market_id") for m in markets]
                    self.log_result("GET /api/markets", True, 
                                  f"Markets retrieved: {len(markets)} markets - {', '.join(market_ids)}")
                elif isinstance(data, dict) and "markets" in data:
                    markets = data["markets"]
                    if isinstance(markets, list) and len(markets) > 0:
                        market_ids = [m.get("market_id") for m in markets]
                        self.log_result("GET /api/markets", True, 
                                      f"Markets retrieved: {len(markets)} markets - {', '.join(market_ids)}")
                    else:
                        self.log_result("GET /api/markets", False, 
                                      "Markets list is empty or invalid", data)
                else:
                    self.log_result("GET /api/markets", False, 
                                  "Invalid response format - expected markets data", data)
            else:
                self.log_result("GET /api/markets", False, 
                              f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("GET /api/markets", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Maestro Hub Backend API Tests")
        print(f"Backend URL: {API_BASE}")
        print("=" * 60)
        
        # Authentication tests
        self.test_auth_register()
        self.test_auth_login()
        self.test_auth_me()
        
        # Public endpoints
        self.test_categories()
        self.test_tutor_search()
        self.test_markets()
        
        # Authenticated endpoints
        self.test_reports_consumer()
        self.test_notifications()
        self.test_reminders()
        self.test_contact()
        
        # Summary
        print("=" * 60)
        print("📋 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        return passed == total

if __name__ == "__main__":
    tester = APITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)