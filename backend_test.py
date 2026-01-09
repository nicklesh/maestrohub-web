#!/usr/bin/env python3
"""
Maestro Hub Backend API Test Suite
Tests all major backend flows including auth, students, tutors, and categories
"""

import requests
import json
import uuid
from datetime import datetime
import sys

# Backend URL from environment
BACKEND_URL = "https://tutorspot-15.preview.emergentagent.com/api"

class Maestro HubAPITester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.session = requests.Session()
        self.auth_token = None
        self.user_data = {}
        self.test_results = []
        
    def log_test(self, test_name, success, details="", error=""):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "error": error,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        if error:
            print(f"   Error: {error}")
        print()

    def make_request(self, method, endpoint, data=None, headers=None, use_auth=False):
        """Make HTTP request with optional authentication"""
        url = f"{self.base_url}{endpoint}"
        
        request_headers = {"Content-Type": "application/json"}
        if headers:
            request_headers.update(headers)
            
        if use_auth and self.auth_token:
            request_headers["Authorization"] = f"Bearer {self.auth_token}"
        
        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=request_headers)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, headers=request_headers)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data, headers=request_headers)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, headers=request_headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except Exception as e:
            return None, str(e)

    def test_health_check(self):
        """Test basic API health"""
        response = self.make_request("GET", "/health")
        if response and response.status_code == 200:
            self.log_test("Health Check", True, "API is responding")
            return True
        else:
            error_msg = f"Status: {response.status_code if response else 'No response'}"
            self.log_test("Health Check", False, error=error_msg)
            return False

    def test_register_consumer(self):
        """Test user registration as consumer"""
        # Generate unique email for testing
        unique_id = uuid.uuid4().hex[:8]
        email = f"testuser_{unique_id}@example.com"
        
        user_data = {
            "email": email,
            "password": "TestPassword123!",
            "name": "Test Consumer User",
            "role": "consumer"
        }
        
        response = self.make_request("POST", "/auth/register", user_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if "user_id" in data and "token" in data:
                self.auth_token = data["token"]
                self.user_data = {
                    "user_id": data["user_id"],
                    "email": email,
                    "role": data["role"]
                }
                self.log_test("Register Consumer", True, f"User ID: {data['user_id']}")
                return True
            else:
                self.log_test("Register Consumer", False, error="Missing user_id or token in response")
                return False
        else:
            error_msg = f"Status: {response.status_code if response else 'No response'}"
            if response:
                try:
                    error_detail = response.json().get("detail", "Unknown error")
                    error_msg += f", Detail: {error_detail}"
                except:
                    pass
            self.log_test("Register Consumer", False, error=error_msg)
            return False

    def test_login(self):
        """Test user login"""
        if not self.user_data.get("email"):
            self.log_test("Login", False, error="No user email available for login test")
            return False
            
        login_data = {
            "email": self.user_data["email"],
            "password": "TestPassword123!"
        }
        
        response = self.make_request("POST", "/auth/login", login_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if "token" in data:
                self.auth_token = data["token"]
                self.log_test("Login", True, f"Token received")
                return True
            else:
                self.log_test("Login", False, error="No token in response")
                return False
        else:
            error_msg = f"Status: {response.status_code if response else 'No response'}"
            if response:
                try:
                    error_detail = response.json().get("detail", "Unknown error")
                    error_msg += f", Detail: {error_detail}"
                except:
                    pass
            self.log_test("Login", False, error=error_msg)
            return False

    def test_get_current_user(self):
        """Test getting current user info"""
        response = self.make_request("GET", "/auth/me", use_auth=True)
        
        if response and response.status_code == 200:
            data = response.json()
            if "user_id" in data and "email" in data:
                self.log_test("Get Current User", True, f"User: {data['name']} ({data['email']})")
                return True
            else:
                self.log_test("Get Current User", False, error="Missing user data in response")
                return False
        else:
            error_msg = f"Status: {response.status_code if response else 'No response'}"
            if response:
                try:
                    error_detail = response.json().get("detail", "Unknown error")
                    error_msg += f", Detail: {error_detail}"
                except:
                    pass
            self.log_test("Get Current User", False, error=error_msg)
            return False

    def test_create_student(self):
        """Test creating a student"""
        student_data = {
            "name": "Emma Johnson",
            "age": 12,
            "grade": "7th Grade",
            "notes": "Interested in advanced mathematics and science"
        }
        
        response = self.make_request("POST", "/students", student_data, use_auth=True)
        
        if response and response.status_code == 200:
            data = response.json()
            if "student_id" in data and "name" in data:
                self.user_data["student_id"] = data["student_id"]
                self.log_test("Create Student", True, f"Student: {data['name']} (ID: {data['student_id']})")
                return True
            else:
                self.log_test("Create Student", False, error="Missing student data in response")
                return False
        else:
            error_msg = f"Status: {response.status_code if response else 'No response'}"
            if response:
                try:
                    error_detail = response.json().get("detail", "Unknown error")
                    error_msg += f", Detail: {error_detail}"
                except:
                    pass
            self.log_test("Create Student", False, error=error_msg)
            return False

    def test_get_students(self):
        """Test getting students list"""
        response = self.make_request("GET", "/students", use_auth=True)
        
        if response and response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                student_count = len(data)
                self.log_test("Get Students", True, f"Retrieved {student_count} students")
                return True
            else:
                self.log_test("Get Students", False, error="Response is not a list")
                return False
        else:
            error_msg = f"Status: {response.status_code if response else 'No response'}"
            if response:
                try:
                    error_detail = response.json().get("detail", "Unknown error")
                    error_msg += f", Detail: {error_detail}"
                except:
                    pass
            self.log_test("Get Students", False, error=error_msg)
            return False

    def test_register_tutor(self):
        """Test registering a new tutor user"""
        # Generate unique email for tutor
        unique_id = uuid.uuid4().hex[:8]
        email = f"tutor_{unique_id}@example.com"
        
        tutor_user_data = {
            "email": email,
            "password": "TutorPassword123!",
            "name": "Dr. Sarah Wilson",
            "role": "tutor"
        }
        
        response = self.make_request("POST", "/auth/register", tutor_user_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if "user_id" in data and "token" in data:
                # Store tutor credentials for profile creation
                self.user_data["tutor_token"] = data["token"]
                self.user_data["tutor_user_id"] = data["user_id"]
                self.user_data["tutor_email"] = email
                self.log_test("Register Tutor", True, f"Tutor User ID: {data['user_id']}")
                return True
            else:
                self.log_test("Register Tutor", False, error="Missing user_id or token in response")
                return False
        else:
            error_msg = f"Status: {response.status_code if response else 'No response'}"
            if response:
                try:
                    error_detail = response.json().get("detail", "Unknown error")
                    error_msg += f", Detail: {error_detail}"
                except:
                    pass
            self.log_test("Register Tutor", False, error=error_msg)
            return False

    def test_create_tutor_profile(self):
        """Test creating tutor profile"""
        if not self.user_data.get("tutor_token"):
            self.log_test("Create Tutor Profile", False, error="No tutor token available")
            return False
            
        profile_data = {
            "bio": "Experienced mathematics and science tutor with 10+ years of teaching experience. Specializes in helping students build confidence and achieve academic excellence.",
            "categories": ["academic"],
            "subjects": ["Math", "Science", "Physics", "Chemistry"],
            "levels": ["middle_school", "high_school", "college"],
            "modality": ["online", "in_person"],
            "service_area_radius": 15,
            "base_price": 75.0,
            "duration_minutes": 60,
            "policies": {
                "cancel_window_hours": 24,
                "no_show_policy": "Full charge for no-shows without 24hr notice",
                "late_arrival_policy": "Lesson time not extended for late arrivals"
            }
        }
        
        headers = {"Authorization": f"Bearer {self.user_data['tutor_token']}"}
        response = self.make_request("POST", "/tutors/profile", profile_data, headers=headers)
        
        if response and response.status_code == 200:
            data = response.json()
            if "tutor_id" in data and "bio" in data:
                self.user_data["tutor_id"] = data["tutor_id"]
                self.log_test("Create Tutor Profile", True, f"Tutor ID: {data['tutor_id']}")
                return True
            else:
                self.log_test("Create Tutor Profile", False, error="Missing tutor profile data in response")
                return False
        else:
            error_msg = f"Status: {response.status_code if response else 'No response'}"
            if response:
                try:
                    error_detail = response.json().get("detail", "Unknown error")
                    error_msg += f", Detail: {error_detail}"
                except:
                    pass
            self.log_test("Create Tutor Profile", False, error=error_msg)
            return False

    def test_search_tutors(self):
        """Test searching for tutors"""
        # Test basic search
        response = self.make_request("GET", "/tutors/search")
        
        if response and response.status_code == 200:
            data = response.json()
            if "tutors" in data and "total" in data:
                tutor_count = len(data["tutors"])
                total_count = data["total"]
                self.log_test("Search Tutors", True, f"Found {tutor_count} tutors (Total: {total_count})")
                return True
            else:
                self.log_test("Search Tutors", False, error="Missing tutors or total in response")
                return False
        else:
            error_msg = f"Status: {response.status_code if response else 'No response'}"
            if response:
                try:
                    error_detail = response.json().get("detail", "Unknown error")
                    error_msg += f", Detail: {error_detail}"
                except:
                    pass
            self.log_test("Search Tutors", False, error=error_msg)
            return False

    def test_get_categories(self):
        """Test getting categories"""
        response = self.make_request("GET", "/categories")
        
        if response and response.status_code == 200:
            data = response.json()
            if "categories" in data and "levels" in data and "modalities" in data:
                category_count = len(data["categories"])
                level_count = len(data["levels"])
                modality_count = len(data["modalities"])
                self.log_test("Get Categories", True, 
                            f"Categories: {category_count}, Levels: {level_count}, Modalities: {modality_count}")
                return True
            else:
                self.log_test("Get Categories", False, error="Missing categories, levels, or modalities in response")
                return False
        else:
            error_msg = f"Status: {response.status_code if response else 'No response'}"
            if response:
                try:
                    error_detail = response.json().get("detail", "Unknown error")
                    error_msg += f", Detail: {error_detail}"
                except:
                    pass
            self.log_test("Get Categories", False, error=error_msg)
            return False

    def run_all_tests(self):
        """Run all backend API tests"""
        print("=" * 60)
        print("ACHARYALY BACKEND API TEST SUITE")
        print("=" * 60)
        print(f"Testing backend at: {self.base_url}")
        print()
        
        # Test sequence
        tests = [
            ("Health Check", self.test_health_check),
            ("Register Consumer", self.test_register_consumer),
            ("Login", self.test_login),
            ("Get Current User", self.test_get_current_user),
            ("Create Student", self.test_create_student),
            ("Get Students", self.test_get_students),
            ("Register Tutor", self.test_register_tutor),
            ("Create Tutor Profile", self.test_create_tutor_profile),
            ("Search Tutors", self.test_search_tutors),
            ("Get Categories", self.test_get_categories),
        ]
        
        for test_name, test_func in tests:
            try:
                test_func()
            except Exception as e:
                self.log_test(test_name, False, error=f"Exception: {str(e)}")
        
        # Summary
        print("=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        # Failed tests details
        failed_tests = [result for result in self.test_results if not result["success"]]
        if failed_tests:
            print("\nFAILED TESTS:")
            for test in failed_tests:
                print(f"❌ {test['test']}: {test['error']}")
        
        return passed == total

if __name__ == "__main__":
    tester = Maestro HubAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)