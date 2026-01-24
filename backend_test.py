#!/usr/bin/env python3
"""
Maestro Hub Backend Security Testing
Tests security fixes for JWT validation, password policy, rate limiting, security headers, and input sanitization
"""

import requests
import json
import time
import sys
from datetime import datetime, timezone

# Configuration
BASE_URL = "https://tutorapp-revamp.preview.emergentagent.com/api"
TEST_CREDENTIALS = {
    "consumer": {"email": "parent2@test.com", "password": "password123"},
    "tutor": {"email": "tutor3@test.com", "password": "password123"}
}

class SecurityTester:
    def __init__(self):
        self.session = requests.Session()
        self.results = {
            "jwt_validation": [],
            "password_policy": [],
            "rate_limiting": [],
            "security_headers": [],
            "input_sanitization": [],
            "summary": {"passed": 0, "failed": 0, "total": 0}
        }
        self.auth_token = None
        
    def log_test(self, category, test_name, passed, details=""):
        """Log test result"""
        result = {
            "test": test_name,
            "passed": passed,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.results[category].append(result)
        self.results["summary"]["total"] += 1
        if passed:
            self.results["summary"]["passed"] += 1
            print(f"✅ {test_name}")
        else:
            self.results["summary"]["failed"] += 1
            print(f"❌ {test_name}: {details}")
    
    def setup_auth(self):
        """Get valid auth token for authenticated tests"""
        try:
            response = self.session.post(f"{BASE_URL}/auth/login", json=TEST_CREDENTIALS["consumer"])
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("token")
                print(f"✅ Authentication setup successful")
                return True
            else:
                print(f"❌ Authentication setup failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Authentication setup error: {str(e)}")
            return False
    
    def test_jwt_validation(self):
        """Test JWT token validation security"""
        print("\n🔐 Testing JWT Token Validation...")
        
        # Test 1: Invalid token format
        fresh_session = requests.Session()  # Use fresh session to avoid cookies
        headers = {"Authorization": "Bearer invalid.token.here"}
        response = fresh_session.get(f"{BASE_URL}/auth/me", headers=headers)
        passed = response.status_code == 401
        self.log_test("jwt_validation", "Invalid token format rejected", passed, 
                     f"Expected 401, got {response.status_code}")
        
        # Test 2: Empty token
        fresh_session = requests.Session()
        headers = {"Authorization": "Bearer "}
        response = fresh_session.get(f"{BASE_URL}/auth/me", headers=headers)
        passed = response.status_code == 401
        self.log_test("jwt_validation", "Empty token rejected", passed,
                     f"Expected 401, got {response.status_code}")
        
        # Test 3: Malformed Bearer token
        fresh_session = requests.Session()
        headers = {"Authorization": "Bearer malformed"}
        response = fresh_session.get(f"{BASE_URL}/auth/me", headers=headers)
        passed = response.status_code == 401
        self.log_test("jwt_validation", "Malformed Bearer token rejected", passed,
                     f"Expected 401, got {response.status_code}")
        
        # Test 4: Random JWT token (not signed with our secret)
        fresh_session = requests.Session()
        fake_jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiZmFrZSIsImV4cCI6OTk5OTk5OTk5OX0.invalid_signature"
        headers = {"Authorization": f"Bearer {fake_jwt}"}
        response = fresh_session.get(f"{BASE_URL}/auth/me", headers=headers)
        passed = response.status_code == 401
        self.log_test("jwt_validation", "Invalid signature JWT rejected", passed,
                     f"Expected 401, got {response.status_code}")
        
        # Test 5: Valid token should work
        if self.auth_token:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = self.session.get(f"{BASE_URL}/auth/me", headers=headers)
            passed = response.status_code == 200
            self.log_test("jwt_validation", "Valid token accepted", passed,
                         f"Expected 200, got {response.status_code}")
    
    def test_password_policy(self):
        """Test password policy enforcement"""
        print("\n🔒 Testing Password Policy...")
        
        test_passwords = [
            ("", "Empty password rejected"),
            ("123", "Short password rejected"),
            ("pass", "Simple password rejected"),
            ("password", "No uppercase password rejected"),
            ("PASSWORD", "No lowercase password rejected"),
            ("Password", "No number password rejected"),
            ("SecurePass123", "Valid password accepted")
        ]
        
        for password, test_name in test_passwords:
            try:
                # Use unique email with timestamp and password hash to avoid conflicts
                import hashlib
                email_hash = hashlib.md5(f"{password}{time.time()}".encode()).hexdigest()[:8]
                test_email = f"test_{email_hash}@test.com"
                
                payload = {
                    "email": test_email,
                    "name": "Test User",
                    "password": password,
                    "role": "consumer"
                }
                
                # Use fresh session to avoid rate limiting conflicts
                fresh_session = requests.Session()
                response = fresh_session.post(f"{BASE_URL}/auth/register", json=payload)
                
                if password == "SecurePass123":
                    # Valid password should succeed
                    passed = response.status_code == 200
                    details = f"Expected 200, got {response.status_code}"
                else:
                    # Invalid passwords should fail
                    passed = response.status_code == 400
                    details = f"Expected 400, got {response.status_code}"
                    if response.status_code == 400:
                        error_msg = response.json().get("detail", "")
                        details += f" - {error_msg}"
                
                self.log_test("password_policy", test_name, passed, details)
                time.sleep(0.2)  # Small delay to avoid rate limiting
                
            except Exception as e:
                self.log_test("password_policy", test_name, False, f"Error: {str(e)}")
    
    def test_rate_limiting(self):
        """Test rate limiting on login attempts"""
        print("\n⏱️ Testing Rate Limiting...")
        
        # Test multiple rapid login attempts
        failed_attempts = 0
        rate_limited = False
        
        for i in range(7):  # Try 7 attempts (limit should be 5/minute)
            try:
                payload = {
                    "email": "nonexistent@test.com",
                    "password": "wrongpassword"
                }
                
                response = self.session.post(f"{BASE_URL}/auth/login", json=payload)
                
                if response.status_code == 429:
                    rate_limited = True
                    break
                elif response.status_code == 401:
                    failed_attempts += 1
                
                time.sleep(0.1)  # Small delay between requests
                
            except Exception as e:
                print(f"Error in rate limit test: {str(e)}")
                break
        
        passed = rate_limited
        details = f"Made {failed_attempts} failed attempts, rate limited: {rate_limited}"
        self.log_test("rate_limiting", "Rate limiting on login attempts", passed, details)
    
    def test_security_headers(self):
        """Test security headers in responses"""
        print("\n🛡️ Testing Security Headers...")
        
        try:
            response = self.session.get(f"{BASE_URL}/health")
            headers = response.headers
            
            expected_headers = {
                "X-Content-Type-Options": "nosniff",
                "X-Frame-Options": "DENY", 
                "X-XSS-Protection": "1; mode=block"
            }
            
            for header_name, expected_value in expected_headers.items():
                actual_value = headers.get(header_name)
                passed = actual_value == expected_value
                details = f"Expected '{expected_value}', got '{actual_value}'"
                self.log_test("security_headers", f"{header_name} header present", passed, details)
                
        except Exception as e:
            self.log_test("security_headers", "Security headers test", False, f"Error: {str(e)}")
    
    def test_input_sanitization(self):
        """Test input sanitization for XSS and NoSQL injection"""
        print("\n🧹 Testing Input Sanitization...")
        
        if not self.auth_token:
            print("❌ Skipping input sanitization tests - no auth token")
            return
        
        # Test XSS in profile update
        try:
            xss_payload = "<script>alert('XSS')</script>"
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            payload = {"name": xss_payload}
            
            response = self.session.put(f"{BASE_URL}/profile", json=payload, headers=headers)
            
            if response.status_code == 200:
                # Check if XSS payload was sanitized
                updated_profile = response.json()
                sanitized_name = updated_profile.get("name", "")
                passed = "<script>" not in sanitized_name
                details = f"XSS payload sanitized: {sanitized_name}"
            else:
                passed = False
                details = f"Profile update failed: {response.status_code}"
            
            self.log_test("input_sanitization", "XSS payload sanitization", passed, details)
            
        except Exception as e:
            self.log_test("input_sanitization", "XSS payload sanitization", False, f"Error: {str(e)}")
        
        # Test NoSQL injection in search
        try:
            nosql_payload = '{"$where": "this.password"}'
            params = {"q": nosql_payload}
            
            response = self.session.get(f"{BASE_URL}/tutors/search", params=params)
            
            # Should not cause server error and should handle safely
            passed = response.status_code in [200, 400]  # Either works safely or rejects
            details = f"NoSQL injection handled safely: {response.status_code}"
            
            self.log_test("input_sanitization", "NoSQL injection prevention", passed, details)
            
        except Exception as e:
            self.log_test("input_sanitization", "NoSQL injection prevention", False, f"Error: {str(e)}")
    
    def run_all_tests(self):
        """Run all security tests"""
        print("🔍 Starting Maestro Hub Security Testing...")
        print(f"Testing against: {BASE_URL}")
        
        # Setup authentication
        if not self.setup_auth():
            print("❌ Cannot proceed without authentication")
            return False
        
        # Run all test categories
        self.test_jwt_validation()
        self.test_password_policy()
        self.test_rate_limiting()
        self.test_security_headers()
        self.test_input_sanitization()
        
        # Print summary
        print(f"\n📊 Security Test Summary:")
        print(f"Total Tests: {self.results['summary']['total']}")
        print(f"Passed: {self.results['summary']['passed']}")
        print(f"Failed: {self.results['summary']['failed']}")
        
        success_rate = (self.results['summary']['passed'] / self.results['summary']['total']) * 100 if self.results['summary']['total'] > 0 else 0
        print(f"Success Rate: {success_rate:.1f}%")
        
        # Save detailed results
        with open('/app/security_test_results.json', 'w') as f:
            json.dump(self.results, f, indent=2)
        
        print(f"\n📄 Detailed results saved to: /app/security_test_results.json")
        
        return self.results['summary']['failed'] == 0

if __name__ == "__main__":
    tester = SecurityTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All security tests passed!")
        sys.exit(0)
    else:
        print(f"\n⚠️ {tester.results['summary']['failed']} security tests failed!")
        sys.exit(1)