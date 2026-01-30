#!/usr/bin/env python3
"""
Backend API Testing for Maestro Habitat
Tests authentication endpoints and health checks
"""

import requests
import sys
import json
from datetime import datetime

class MaestroHabitatAPITester:
    def __init__(self, base_url="https://habitat-hub-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details="", expected_status=None, actual_status=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
            if expected_status and actual_status:
                print(f"   Expected: {expected_status}, Got: {actual_status}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "expected_status": expected_status,
            "actual_status": actual_status
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            self.log_test(name, success, 
                         f"Response: {response.text[:200]}" if not success else "",
                         expected_status, response.status_code)

            return success, response.json() if success and response.content else {}

        except requests.exceptions.Timeout:
            self.log_test(name, False, "Request timeout (>10s)")
            return False, {}
        except requests.exceptions.ConnectionError:
            self.log_test(name, False, "Connection error - server may be down")
            return False, {}
        except Exception as e:
            self.log_test(name, False, f"Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test API health endpoint"""
        print("\n🔍 Testing Health Check...")
        success, response = self.run_test(
            "Health Check",
            "GET",
            "health",
            200
        )
        return success

    def test_api_health_check(self):
        """Test API health endpoint with /api prefix"""
        print("\n🔍 Testing API Health Check...")
        success, response = self.run_test(
            "API Health Check",
            "GET", 
            "api/health",
            200
        )
        return success

    def test_invalid_login(self):
        """Test login with invalid credentials"""
        print("\n🔍 Testing Invalid Login...")
        success, response = self.run_test(
            "Invalid Login",
            "POST",
            "api/auth/login",
            401,
            data={
                "email": "invalid@test.com",
                "password": "wrongpassword",
                "device": {
                    "device_id": "test_device_123",
                    "device_name": "Test Browser",
                    "platform": "web"
                }
            }
        )
        return success

    def test_register_validation(self):
        """Test registration with invalid data"""
        print("\n🔍 Testing Registration Validation...")
        
        # Test missing fields
        success1, _ = self.run_test(
            "Register - Missing Fields",
            "POST",
            "api/auth/register",
            422,  # Validation error
            data={"email": "test@example.com"}
        )
        
        # Test weak password
        success2, _ = self.run_test(
            "Register - Weak Password",
            "POST", 
            "api/auth/register",
            400,
            data={
                "email": "test@example.com",
                "password": "123",
                "name": "Test User",
                "role": "consumer"
            }
        )
        
        return success1 and success2

    def test_forgot_password(self):
        """Test forgot password endpoint"""
        print("\n🔍 Testing Forgot Password...")
        success, response = self.run_test(
            "Forgot Password",
            "POST",
            "api/auth/forgot-password",
            200,
            data={"email": "nonexistent@test.com"}
        )
        return success

    def test_auth_me_unauthorized(self):
        """Test /auth/me without token"""
        print("\n🔍 Testing Auth Me (Unauthorized)...")
        success, response = self.run_test(
            "Auth Me - Unauthorized",
            "GET",
            "api/auth/me",
            401
        )
        return success

    def test_cors_headers(self):
        """Test CORS headers are present"""
        print("\n🔍 Testing CORS Headers...")
        try:
            response = requests.options(f"{self.base_url}/api/auth/login", timeout=10)
            cors_headers = [
                'Access-Control-Allow-Origin',
                'Access-Control-Allow-Methods', 
                'Access-Control-Allow-Headers'
            ]
            
            has_cors = any(header in response.headers for header in cors_headers)
            self.log_test("CORS Headers", has_cors, 
                         f"Headers: {list(response.headers.keys())}" if not has_cors else "")
            return has_cors
        except Exception as e:
            self.log_test("CORS Headers", False, f"Error: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all backend tests"""
        print("=" * 60)
        print("🚀 MAESTRO HABITAT BACKEND API TESTS")
        print("=" * 60)
        print(f"Testing against: {self.base_url}")
        
        # Core health checks
        self.test_health_check()
        self.test_api_health_check()
        
        # Authentication tests
        self.test_invalid_login()
        self.test_register_validation()
        self.test_forgot_password()
        self.test_auth_me_unauthorized()
        
        # Infrastructure tests
        self.test_cors_headers()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 TEST SUMMARY")
        print("=" * 60)
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.tests_passed < self.tests_run:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test execution"""
    tester = MaestroHabitatAPITester()
    
    try:
        success = tester.run_all_tests()
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n\n⚠️ Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n\n💥 Unexpected error: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())