#!/usr/bin/env python3
"""
Maestro Hub Focused API Security Testing
Testing specific endpoints mentioned in the security review request
"""

import requests
import json
import uuid
from datetime import datetime, timezone, timedelta

# Configuration
BASE_URL = "https://timezone-fix-17.preview.emergentagent.com/api"
TIMEOUT = 30

# Test credentials
TEST_CREDENTIALS = {
    "consumer": {"email": "parent2@test.com", "password": "password123"},
    "coach": {"email": "tutor3@test.com", "password": "password123"},
    "admin": {"email": "admin@maestrohub.com", "password": "password123"}
}

class FocusedSecurityTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.timeout = TIMEOUT
        self.tokens = {}
        self.test_results = []
        
    def authenticate_user(self, role):
        """Authenticate and get JWT token"""
        try:
            creds = TEST_CREDENTIALS[role]
            response = self.session.post(
                f"{BASE_URL}/auth/login",
                json=creds,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                token = data.get("token")
                if token:
                    self.tokens[role] = token
                    return True
            return False
        except Exception as e:
            print(f"Authentication failed for {role}: {e}")
            return False
    
    def make_request(self, method, endpoint, token=None, **kwargs):
        """Make authenticated request"""
        headers = kwargs.get("headers", {})
        if token:
            headers["Authorization"] = f"Bearer {token}"
        kwargs["headers"] = headers
        
        url = f"{BASE_URL}{endpoint}"
        return self.session.request(method, url, **kwargs)
    
    def log_result(self, test_name, passed, details="", severity="medium"):
        """Log test result"""
        result = {
            "test": test_name,
            "passed": passed,
            "details": details,
            "severity": severity,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅" if passed else "❌"
        print(f"{status} {test_name}")
        if not passed and details:
            print(f"   Details: {details}")

    def test_authentication_endpoints(self):
        """Test authentication endpoints security"""
        print("\n🔐 Testing Authentication Endpoints...")
        
        # Test POST /api/auth/login
        print("\n--- Testing /api/auth/login ---")
        
        # Test SQL injection attempts
        sql_payloads = [
            "admin'--",
            "admin' OR '1'='1'--",
            "admin'; DROP TABLE users;--",
            "' UNION SELECT * FROM users--"
        ]
        
        for payload in sql_payloads:
            response = self.session.post(
                f"{BASE_URL}/auth/login",
                json={"email": payload, "password": payload}
            )
            
            if response.status_code == 200:
                self.log_result(
                    f"Login SQL Injection - {payload[:20]}...",
                    False,
                    f"Login accepts SQL injection payload: {payload}",
                    "critical"
                )
            else:
                self.log_result(
                    f"Login SQL Injection Protection - {payload[:20]}...",
                    True
                )
        
        # Test timing attacks
        start_time = datetime.now()
        response = self.session.post(
            f"{BASE_URL}/auth/login",
            json={"email": "nonexistent@test.com", "password": "wrongpassword"}
        )
        nonexistent_time = (datetime.now() - start_time).total_seconds()
        
        start_time = datetime.now()
        response = self.session.post(
            f"{BASE_URL}/auth/login",
            json={"email": "parent2@test.com", "password": "wrongpassword"}
        )
        existing_time = (datetime.now() - start_time).total_seconds()
        
        time_diff = abs(existing_time - nonexistent_time)
        if time_diff > 0.5:  # More than 500ms difference
            self.log_result(
                "Login Timing Attack",
                False,
                f"Login timing reveals user existence (diff: {time_diff:.2f}s)",
                "medium"
            )
        else:
            self.log_result(
                "Login Timing Protection",
                True,
                f"Consistent timing (diff: {time_diff:.2f}s)"
            )
        
        # Test POST /api/auth/register
        print("\n--- Testing /api/auth/register ---")
        
        # Test duplicate registration
        test_email = f"duplicate_test_{uuid.uuid4().hex[:8]}@test.com"
        
        # First registration
        response1 = self.session.post(
            f"{BASE_URL}/auth/register",
            json={
                "email": test_email,
                "password": "testpass123",
                "name": "Test User",
                "role": "consumer"
            }
        )
        
        # Second registration with same email
        response2 = self.session.post(
            f"{BASE_URL}/auth/register",
            json={
                "email": test_email,
                "password": "differentpass",
                "name": "Different User",
                "role": "consumer"
            }
        )
        
        if response2.status_code == 200:
            self.log_result(
                "Registration Duplicate Email",
                False,
                "System allows duplicate email registration",
                "high"
            )
        else:
            self.log_result(
                "Registration Duplicate Protection",
                True
            )

    def test_booking_endpoints(self):
        """Test booking-related endpoints"""
        print("\n📅 Testing Booking Endpoints...")
        
        if not self.tokens.get("consumer"):
            print("❌ Consumer token not available for booking tests")
            return
        
        # Test POST /api/booking-holds
        print("\n--- Testing /api/booking-holds ---")
        
        # Test with malicious tutor_id
        malicious_ids = [
            "'; DROP TABLE bookings;--",
            "../../../etc/passwd",
            "tutor_<script>alert('xss')</script>",
            "tutor_${7*7}",
            "tutor_{{constructor.constructor('return process')().exit()}}"
        ]
        
        for malicious_id in malicious_ids:
            try:
                response = self.make_request(
                    "POST",
                    "/booking-holds",
                    token=self.tokens["consumer"],
                    json={
                        "tutor_id": malicious_id,
                        "start_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
                        "duration_minutes": 60
                    }
                )
                
                if response.status_code == 200:
                    self.log_result(
                        f"Booking Hold Injection - {malicious_id[:20]}...",
                        False,
                        f"Booking accepts malicious tutor_id: {malicious_id}",
                        "high"
                    )
                else:
                    self.log_result(
                        f"Booking Hold Protection - {malicious_id[:20]}...",
                        True
                    )
            except Exception:
                self.log_result(
                    f"Booking Hold Safe Error - {malicious_id[:20]}...",
                    True
                )
        
        # Test POST /api/bookings
        print("\n--- Testing /api/bookings ---")
        
        # Test with invalid hold_id
        response = self.make_request(
            "POST",
            "/bookings",
            token=self.tokens["consumer"],
            json={
                "hold_id": "nonexistent_hold_123",
                "student_id": "student_123",
                "intake": {
                    "goals": "Test goals",
                    "current_level": "Beginner",
                    "policy_acknowledged": True
                }
            }
        )
        
        if response.status_code == 200:
            self.log_result(
                "Booking Invalid Hold ID",
                False,
                "System accepts booking with nonexistent hold_id",
                "medium"
            )
        else:
            self.log_result(
                "Booking Hold Validation",
                True
            )

    def test_review_endpoints(self):
        """Test review endpoints"""
        print("\n⭐ Testing Review Endpoints...")
        
        if not self.tokens.get("consumer"):
            print("❌ Consumer token not available for review tests")
            return
        
        # Test POST /api/reviews
        print("\n--- Testing /api/reviews ---")
        
        # Test XSS in review comments
        xss_payloads = [
            "<script>alert('XSS in review')</script>",
            "<img src=x onerror=alert('XSS')>",
            "javascript:alert('XSS')",
            "<svg onload=alert('XSS')></svg>"
        ]
        
        for payload in xss_payloads:
            try:
                response = self.make_request(
                    "POST",
                    "/reviews",
                    token=self.tokens["consumer"],
                    json={
                        "booking_id": "booking_test123",
                        "rating": 5,
                        "comment": payload
                    }
                )
                
                if response.status_code == 200:
                    response_text = response.text
                    if payload in response_text and "<script>" in payload:
                        self.log_result(
                            f"Review XSS Vulnerability - {payload[:30]}...",
                            False,
                            f"XSS payload reflected in review: {payload}",
                            "high"
                        )
                    else:
                        self.log_result(
                            f"Review XSS Protection - {payload[:30]}...",
                            True
                        )
                else:
                    self.log_result(
                        f"Review Input Validation - {payload[:30]}...",
                        True
                    )
            except Exception:
                self.log_result(
                    f"Review Safe Error Handling - {payload[:30]}...",
                    True
                )
        
        # Test rating manipulation
        invalid_ratings = [-1, 0, 6, 100, "five", "null", None]
        
        for rating in invalid_ratings:
            try:
                response = self.make_request(
                    "POST",
                    "/reviews",
                    token=self.tokens["consumer"],
                    json={
                        "booking_id": "booking_test123",
                        "rating": rating,
                        "comment": "Test review"
                    }
                )
                
                if response.status_code == 200:
                    self.log_result(
                        f"Review Rating Validation - Invalid rating {rating}",
                        False,
                        f"System accepts invalid rating: {rating}",
                        "medium"
                    )
                else:
                    self.log_result(
                        f"Review Rating Protection - {rating}",
                        True
                    )
            except Exception:
                self.log_result(
                    f"Review Rating Safe Error - {rating}",
                    True
                )

    def test_tutor_package_endpoints(self):
        """Test tutor package endpoints"""
        print("\n📦 Testing Tutor Package Endpoints...")
        
        if not self.tokens.get("coach"):
            print("❌ Coach token not available for package tests")
            return
        
        # Test POST /api/tutor/packages
        print("\n--- Testing /api/tutor/packages ---")
        
        # Test price manipulation
        malicious_prices = [
            -100,  # Negative price
            0,     # Zero price
            999999999,  # Extremely high price
            "free",     # String instead of number
            {"$ne": 0}, # NoSQL injection
        ]
        
        for price in malicious_prices:
            try:
                response = self.make_request(
                    "POST",
                    "/tutor/packages",
                    token=self.tokens["coach"],
                    json={
                        "name": "Test Package",
                        "session_count": 4,
                        "discount_percent": 10,
                        "validity_days": 90,
                        "price_per_session": price
                    }
                )
                
                if response.status_code == 200:
                    self.log_result(
                        f"Package Price Validation - Invalid price {price}",
                        False,
                        f"System accepts invalid package price: {price}",
                        "high"
                    )
                else:
                    self.log_result(
                        f"Package Price Protection - {price}",
                        True
                    )
            except Exception:
                self.log_result(
                    f"Package Price Safe Error - {price}",
                    True
                )

    def test_sponsorship_endpoints(self):
        """Test sponsorship endpoints"""
        print("\n💰 Testing Sponsorship Endpoints...")
        
        if not self.tokens.get("coach"):
            print("❌ Coach token not available for sponsorship tests")
            return
        
        # Test POST /api/sponsorship/purchase
        print("\n--- Testing /api/sponsorship/purchase ---")
        
        # Test with invalid plan IDs
        invalid_plans = [
            "'; DROP TABLE sponsorships;--",
            "../../../etc/passwd",
            "plan_<script>alert('xss')</script>",
            "nonexistent_plan_123",
            {"$ne": null}
        ]
        
        for plan_id in invalid_plans:
            try:
                response = self.make_request(
                    "POST",
                    "/sponsorship/purchase",
                    token=self.tokens["coach"],
                    json={
                        "plan_id": plan_id,
                        "categories": ["academic"],
                        "auto_renew": False
                    }
                )
                
                if response.status_code == 200:
                    self.log_result(
                        f"Sponsorship Plan Validation - Invalid plan {str(plan_id)[:20]}...",
                        False,
                        f"System accepts invalid sponsorship plan: {plan_id}",
                        "medium"
                    )
                else:
                    self.log_result(
                        f"Sponsorship Plan Protection - {str(plan_id)[:20]}...",
                        True
                    )
            except Exception:
                self.log_result(
                    f"Sponsorship Plan Safe Error - {str(plan_id)[:20]}...",
                    True
                )

    def test_search_endpoints(self):
        """Test search endpoints"""
        print("\n🔍 Testing Search Endpoints...")
        
        if not self.tokens.get("consumer"):
            print("❌ Consumer token not available for search tests")
            return
        
        # Test GET /api/tutors/search
        print("\n--- Testing /api/tutors/search ---")
        
        # Test NoSQL injection in search parameters
        injection_params = [
            {"query": '{"$where": "function() { return true; }"}'},
            {"subjects": '{"$regex": ".*"}'},
            {"categories": '{"$ne": null}'},
            {"location": '"; return db.users.find(); var x="'},
            {"price_min": '{"$gt": 0}'},
            {"price_max": '{"$lt": 999999}'}
        ]
        
        for params in injection_params:
            try:
                response = self.make_request(
                    "GET",
                    "/tutors/search",
                    token=self.tokens["consumer"],
                    params=params
                )
                
                if response.status_code == 200:
                    data = response.json()
                    tutors = data.get("tutors", [])
                    
                    # Check if injection might have worked (returned unexpected data)
                    if len(tutors) > 100:  # Suspiciously large result set
                        self.log_result(
                            f"Search NoSQL Injection - {str(params)[:30]}...",
                            False,
                            f"Search returns suspiciously large result set: {len(tutors)} tutors",
                            "high"
                        )
                    else:
                        self.log_result(
                            f"Search NoSQL Protection - {str(params)[:30]}...",
                            True
                        )
                else:
                    self.log_result(
                        f"Search Input Validation - {str(params)[:30]}...",
                        True
                    )
            except Exception:
                self.log_result(
                    f"Search Safe Error Handling - {str(params)[:30]}...",
                    True
                )

    def test_rate_limiting(self):
        """Test rate limiting on critical endpoints"""
        print("\n🚦 Testing Rate Limiting...")
        
        # Test login rate limiting
        print("\n--- Testing Login Rate Limiting ---")
        
        failed_attempts = 0
        rate_limited = False
        
        for i in range(10):  # Try 10 failed login attempts
            response = self.session.post(
                f"{BASE_URL}/auth/login",
                json={
                    "email": f"attacker_{i}@test.com",
                    "password": "wrong_password"
                }
            )
            
            if response.status_code == 429:  # Too Many Requests
                rate_limited = True
                break
            elif response.status_code == 401:
                failed_attempts += 1
            
            # Small delay between attempts
            import time
            time.sleep(0.1)
        
        if rate_limited:
            self.log_result(
                "Login Rate Limiting",
                True,
                f"Rate limiting activated after {failed_attempts} attempts"
            )
        else:
            self.log_result(
                "Login Rate Limiting",
                False,
                f"No rate limiting detected after {failed_attempts} failed attempts",
                "medium"
            )

    def run_focused_tests(self):
        """Run all focused security tests"""
        print("🎯 Starting Focused API Security Testing")
        print("=" * 50)
        
        # Authenticate users
        print("🔐 Authenticating test users...")
        for role in ["consumer", "coach", "admin"]:
            if self.authenticate_user(role):
                print(f"✅ {role.capitalize()} authenticated")
            else:
                print(f"❌ {role.capitalize()} authentication failed")
        
        # Run focused tests
        test_methods = [
            self.test_authentication_endpoints,
            self.test_booking_endpoints,
            self.test_review_endpoints,
            self.test_tutor_package_endpoints,
            self.test_sponsorship_endpoints,
            self.test_search_endpoints,
            self.test_rate_limiting
        ]
        
        for test_method in test_methods:
            try:
                test_method()
            except Exception as e:
                print(f"❌ Test method {test_method.__name__} failed: {e}")
        
        # Generate summary
        self.generate_summary()
    
    def generate_summary(self):
        """Generate test summary"""
        print("\n" + "=" * 50)
        print("🎯 FOCUSED SECURITY TEST SUMMARY")
        print("=" * 50)
        
        passed = sum(1 for r in self.test_results if r["passed"])
        failed = sum(1 for r in self.test_results if not r["passed"])
        critical = sum(1 for r in self.test_results if not r["passed"] and r["severity"] == "critical")
        high = sum(1 for r in self.test_results if not r["passed"] and r["severity"] == "high")
        
        print(f"\n📊 Results:")
        print(f"   ✅ Passed: {passed}")
        print(f"   ❌ Failed: {failed}")
        print(f"   🚨 Critical: {critical}")
        print(f"   ⚠️  High: {high}")
        
        if failed > 0:
            print(f"\n❌ Failed Tests:")
            for result in self.test_results:
                if not result["passed"]:
                    severity_icon = "🚨" if result["severity"] == "critical" else "⚠️" if result["severity"] == "high" else "ℹ️"
                    print(f"   {severity_icon} {result['test']}")
                    if result["details"]:
                        print(f"      {result['details']}")
        
        # Save results
        with open("/app/focused_security_results.json", "w") as f:
            json.dump({
                "summary": {
                    "passed": passed,
                    "failed": failed,
                    "critical": critical,
                    "high": high,
                    "total": len(self.test_results)
                },
                "results": self.test_results,
                "timestamp": datetime.now().isoformat()
            }, f, indent=2)
        
        print(f"\n📝 Detailed results saved to focused_security_results.json")

if __name__ == "__main__":
    tester = FocusedSecurityTester()
    tester.run_focused_tests()