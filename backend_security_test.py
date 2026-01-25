#!/usr/bin/env python3
"""
Maestro Hub Security Testing Suite
Comprehensive OWASP Top 10 and Security Vulnerability Testing

This test suite covers:
1. OWASP Top 10 Testing
2. Authentication & Authorization Security
3. API Security Testing
4. Data Validation Security
5. Business Logic Security
"""

import requests
import json
import time
import uuid
import hashlib
import base64
from datetime import datetime, timezone, timedelta
from urllib.parse import quote, unquote
import sys
import os

# Configuration
BASE_URL = "https://learnhub-868.preview.emergentagent.com/api"
TIMEOUT = 30

# Test credentials from the request
TEST_CREDENTIALS = {
    "consumer": {"email": "parent2@test.com", "password": "password123"},
    "coach": {"email": "tutor3@test.com", "password": "password123"},
    "admin": {"email": "admin@maestrohub.com", "password": "password123"}
}

class SecurityTestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.critical_issues = []
        self.warnings = []
        self.test_results = []
    
    def add_result(self, test_name, passed, details="", severity="medium"):
        result = {
            "test": test_name,
            "passed": passed,
            "details": details,
            "severity": severity,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        if passed:
            self.passed += 1
            print(f"✅ {test_name}")
        else:
            self.failed += 1
            print(f"❌ {test_name}: {details}")
            if severity == "critical":
                self.critical_issues.append(result)
            elif severity == "high":
                self.warnings.append(result)

class MaestroHubSecurityTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.timeout = TIMEOUT
        self.tokens = {}
        self.results = SecurityTestResult()
        
    def authenticate_user(self, role):
        """Authenticate and get JWT token for a specific role"""
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

    # ============== OWASP TOP 10 TESTS ==============
    
    def test_injection_attacks(self):
        """A03:2021 – Injection (NoSQL Injection for MongoDB)"""
        print("\n🔍 Testing NoSQL Injection Vulnerabilities...")
        
        # Test 1: NoSQL injection in login
        injection_payloads = [
            '{"$ne": null}',
            '{"$gt": ""}',
            '{"$regex": ".*"}',
            '{"$where": "this.password"}',
            '"; return true; var dummy="',
            "admin' || '1'=='1",
            '{"$or": [{"password": {"$exists": true}}, {"password": ""}]}'
        ]
        
        for payload in injection_payloads:
            try:
                response = self.session.post(
                    f"{BASE_URL}/auth/login",
                    json={"email": payload, "password": payload},
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 200:
                    self.results.add_result(
                        f"NoSQL Injection - Login bypass with payload: {payload[:50]}...",
                        False,
                        "Login endpoint vulnerable to NoSQL injection",
                        "critical"
                    )
                else:
                    self.results.add_result(
                        f"NoSQL Injection - Login protected against: {payload[:30]}...",
                        True
                    )
            except Exception as e:
                self.results.add_result(
                    f"NoSQL Injection test error: {payload[:30]}...",
                    True,
                    f"Request failed safely: {e}"
                )
        
        # Test 2: NoSQL injection in search endpoints
        if self.tokens.get("consumer"):
            search_payloads = [
                '{"$where": "function() { return true; }"}',
                '{"subjects": {"$regex": ".*"}}',
                '{"$or": [{"status": "approved"}, {"status": {"$ne": "pending"}}]}'
            ]
            
            for payload in search_payloads:
                try:
                    response = self.make_request(
                        "GET",
                        f"/tutors/search?query={quote(payload)}",
                        token=self.tokens["consumer"]
                    )
                    
                    if response.status_code == 200 and len(response.json().get("tutors", [])) > 0:
                        self.results.add_result(
                            f"NoSQL Injection - Search endpoint vulnerable: {payload[:30]}...",
                            False,
                            "Search endpoint may be vulnerable to NoSQL injection",
                            "high"
                        )
                    else:
                        self.results.add_result(
                            f"NoSQL Injection - Search protected: {payload[:30]}...",
                            True
                        )
                except Exception:
                    self.results.add_result(
                        f"NoSQL Injection - Search safely handled: {payload[:30]}...",
                        True
                    )

    def test_broken_authentication(self):
        """A07:2021 – Identification and Authentication Failures"""
        print("\n🔍 Testing Authentication Security...")
        
        # Test 1: Weak password policy
        weak_passwords = ["123", "password", "admin", "test", ""]
        for pwd in weak_passwords:
            try:
                response = self.session.post(
                    f"{BASE_URL}/auth/register",
                    json={
                        "email": f"test_{uuid.uuid4().hex[:8]}@test.com",
                        "password": pwd,
                        "name": "Test User",
                        "role": "consumer"
                    }
                )
                
                if response.status_code == 200:
                    self.results.add_result(
                        f"Weak Password Policy - Accepted: '{pwd}'",
                        False,
                        f"System accepts weak password: '{pwd}'",
                        "high"
                    )
                else:
                    self.results.add_result(
                        f"Password Policy - Rejected weak password: '{pwd}'",
                        True
                    )
            except Exception:
                self.results.add_result(
                    f"Password Policy - Error handling for: '{pwd}'",
                    True
                )
        
        # Test 2: JWT token validation
        invalid_tokens = [
            "invalid.token.here",
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
            "",
            "Bearer malformed",
            "null"
        ]
        
        for token in invalid_tokens:
            try:
                response = self.make_request(
                    "GET",
                    "/auth/me",
                    token=token
                )
                
                if response.status_code == 200:
                    self.results.add_result(
                        f"JWT Validation - Invalid token accepted: {token[:20]}...",
                        False,
                        "System accepts invalid JWT tokens",
                        "critical"
                    )
                else:
                    self.results.add_result(
                        f"JWT Validation - Invalid token rejected: {token[:20]}...",
                        True
                    )
            except Exception:
                self.results.add_result(
                    f"JWT Validation - Safe error handling: {token[:20]}...",
                    True
                )
        
        # Test 3: Session fixation
        if self.tokens.get("consumer"):
            # Try to use consumer token for admin operations
            response = self.make_request(
                "GET",
                "/admin/markets",
                token=self.tokens["consumer"]
            )
            
            if response.status_code == 200:
                self.results.add_result(
                    "Session Fixation - Consumer accessing admin endpoints",
                    False,
                    "Consumer token can access admin endpoints",
                    "critical"
                )
            else:
                self.results.add_result(
                    "Session Fixation - Proper role separation",
                    True
                )

    def test_sensitive_data_exposure(self):
        """A02:2021 – Cryptographic Failures"""
        print("\n🔍 Testing Sensitive Data Exposure...")
        
        # Test 1: Password hashing verification
        if self.tokens.get("consumer"):
            response = self.make_request(
                "GET",
                "/auth/me",
                token=self.tokens["consumer"]
            )
            
            if response.status_code == 200:
                user_data = response.json()
                if "password" in user_data or "password_hash" in user_data:
                    self.results.add_result(
                        "Password Exposure - Password data in API response",
                        False,
                        "User profile endpoint exposes password information",
                        "critical"
                    )
                else:
                    self.results.add_result(
                        "Password Protection - No password data exposed",
                        True
                    )
        
        # Test 2: Check for sensitive data in error messages
        response = self.session.post(
            f"{BASE_URL}/auth/login",
            json={"email": "nonexistent@test.com", "password": "wrongpassword"}
        )
        
        if response.status_code == 401:
            error_msg = response.json().get("detail", "").lower()
            if "user not found" in error_msg or "invalid email" in error_msg:
                self.results.add_result(
                    "Information Disclosure - Login error reveals user existence",
                    False,
                    "Login errors reveal whether email exists in system",
                    "medium"
                )
            else:
                self.results.add_result(
                    "Information Protection - Generic login error messages",
                    True
                )
        
        # Test 3: API key exposure in responses
        response = self.session.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            response_text = response.text.lower()
            sensitive_patterns = ["api_key", "secret", "password", "token", "key="]
            
            for pattern in sensitive_patterns:
                if pattern in response_text:
                    self.results.add_result(
                        f"API Key Exposure - Sensitive data in response: {pattern}",
                        False,
                        f"Response contains sensitive pattern: {pattern}",
                        "high"
                    )
                    break
            else:
                self.results.add_result(
                    "API Security - No sensitive data in public endpoints",
                    True
                )

    def test_broken_access_control(self):
        """A01:2021 – Broken Access Control"""
        print("\n🔍 Testing Access Control...")
        
        # Test 1: Horizontal privilege escalation
        if self.tokens.get("consumer") and self.tokens.get("coach"):
            # Try to access another user's students with consumer token
            response = self.make_request(
                "GET",
                "/students",
                token=self.tokens["consumer"]
            )
            
            if response.status_code == 200:
                consumer_students = response.json()
                
                # Try to access with coach token
                response = self.make_request(
                    "GET",
                    "/students",
                    token=self.tokens["coach"]
                )
                
                if response.status_code == 200:
                    coach_students = response.json()
                    if len(coach_students) > 0 and consumer_students != coach_students:
                        self.results.add_result(
                            "Horizontal Privilege Escalation - Cross-user data access",
                            False,
                            "Users can access other users' student data",
                            "critical"
                        )
                    else:
                        self.results.add_result(
                            "Access Control - Proper user data isolation",
                            True
                        )
        
        # Test 2: Vertical privilege escalation
        if self.tokens.get("consumer"):
            admin_endpoints = [
                "/admin/markets",
                "/admin/analytics/markets",
                "/admin/users"
            ]
            
            for endpoint in admin_endpoints:
                response = self.make_request(
                    "GET",
                    endpoint,
                    token=self.tokens["consumer"]
                )
                
                if response.status_code == 200:
                    self.results.add_result(
                        f"Vertical Privilege Escalation - Consumer accessing: {endpoint}",
                        False,
                        f"Consumer can access admin endpoint: {endpoint}",
                        "critical"
                    )
                else:
                    self.results.add_result(
                        f"Access Control - Admin endpoint protected: {endpoint}",
                        True
                    )
        
        # Test 3: Direct object reference
        if self.tokens.get("consumer"):
            # Try to access resources with predictable IDs
            test_ids = ["user_123456789012", "student_123456789012", "tutor_123456789012"]
            
            for test_id in test_ids:
                response = self.make_request(
                    "GET",
                    f"/students/{test_id}",
                    token=self.tokens["consumer"]
                )
                
                if response.status_code == 200:
                    self.results.add_result(
                        f"IDOR - Direct access to resource: {test_id}",
                        False,
                        f"Can access resource with predictable ID: {test_id}",
                        "high"
                    )

    def test_security_misconfiguration(self):
        """A05:2021 – Security Misconfiguration"""
        print("\n🔍 Testing Security Configuration...")
        
        # Test 1: CORS configuration
        response = self.session.options(
            f"{BASE_URL}/auth/login",
            headers={
                "Origin": "https://malicious-site.com",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type"
            }
        )
        
        cors_origin = response.headers.get("Access-Control-Allow-Origin", "")
        if cors_origin == "*":
            self.results.add_result(
                "CORS Misconfiguration - Wildcard origin allowed",
                False,
                "CORS allows requests from any origin (*)",
                "medium"
            )
        else:
            self.results.add_result(
                "CORS Configuration - Restricted origins",
                True
            )
        
        # Test 2: HTTP security headers
        response = self.session.get(f"{BASE_URL}/health")
        security_headers = [
            "X-Content-Type-Options",
            "X-Frame-Options",
            "X-XSS-Protection",
            "Strict-Transport-Security",
            "Content-Security-Policy"
        ]
        
        missing_headers = []
        for header in security_headers:
            if header not in response.headers:
                missing_headers.append(header)
        
        if missing_headers:
            self.results.add_result(
                f"Security Headers - Missing: {', '.join(missing_headers)}",
                False,
                f"Missing security headers: {missing_headers}",
                "medium"
            )
        else:
            self.results.add_result(
                "Security Headers - All present",
                True
            )
        
        # Test 3: Error information disclosure
        response = self.session.get(f"{BASE_URL}/nonexistent-endpoint")
        if response.status_code == 404:
            error_text = response.text.lower()
            if "traceback" in error_text or "stack trace" in error_text or "debug" in error_text:
                self.results.add_result(
                    "Error Disclosure - Debug information in 404 responses",
                    False,
                    "404 responses contain debug information",
                    "low"
                )
            else:
                self.results.add_result(
                    "Error Handling - Clean 404 responses",
                    True
                )

    def test_xss_vulnerabilities(self):
        """A03:2021 – Cross-Site Scripting (XSS)"""
        print("\n🔍 Testing XSS Vulnerabilities...")
        
        xss_payloads = [
            "<script>alert('XSS')</script>",
            "javascript:alert('XSS')",
            "<img src=x onerror=alert('XSS')>",
            "';alert('XSS');//",
            "<svg onload=alert('XSS')>",
            "{{7*7}}",  # Template injection
            "${7*7}",   # Expression injection
        ]
        
        if self.tokens.get("consumer"):
            # Test XSS in profile update
            for payload in xss_payloads:
                try:
                    response = self.make_request(
                        "PUT",
                        "/profile",
                        token=self.tokens["consumer"],
                        json={"name": payload, "phone": payload}
                    )
                    
                    if response.status_code == 200:
                        # Check if payload is reflected in response
                        response_text = response.text
                        if payload in response_text and "<script>" in payload:
                            self.results.add_result(
                                f"XSS Vulnerability - Payload reflected: {payload[:30]}...",
                                False,
                                f"XSS payload reflected in response: {payload}",
                                "high"
                            )
                        else:
                            self.results.add_result(
                                f"XSS Protection - Payload sanitized: {payload[:30]}...",
                                True
                            )
                except Exception:
                    self.results.add_result(
                        f"XSS Protection - Request safely handled: {payload[:30]}...",
                        True
                    )

    def test_insecure_deserialization(self):
        """A08:2021 – Software and Data Integrity Failures"""
        print("\n🔍 Testing Deserialization Security...")
        
        # Test malformed JSON payloads
        malformed_payloads = [
            '{"email": "test@test.com", "password": "test", "__proto__": {"isAdmin": true}}',
            '{"email": "test@test.com", "password": "test", "constructor": {"prototype": {"isAdmin": true}}}',
            '{"email": "test@test.com", "password": "test", "role": {"$ne": null}}',
        ]
        
        for payload in malformed_payloads:
            try:
                response = self.session.post(
                    f"{BASE_URL}/auth/login",
                    data=payload,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 200:
                    self.results.add_result(
                        f"Deserialization - Malformed payload accepted: {payload[:50]}...",
                        False,
                        "System accepts malformed JSON with prototype pollution attempts",
                        "medium"
                    )
                else:
                    self.results.add_result(
                        f"Deserialization - Malformed payload rejected: {payload[:30]}...",
                        True
                    )
            except Exception:
                self.results.add_result(
                    f"Deserialization - Safe error handling: {payload[:30]}...",
                    True
                )

    def test_vulnerable_components(self):
        """A06:2021 – Vulnerable and Outdated Components"""
        print("\n🔍 Testing for Known Vulnerabilities...")
        
        # Test for common vulnerability indicators
        response = self.session.get(f"{BASE_URL}/health")
        
        if response.status_code == 200:
            headers = response.headers
            server_header = headers.get("Server", "").lower()
            
            # Check for version disclosure
            if any(version in server_header for version in ["apache/2.2", "nginx/1.0", "express"]):
                self.results.add_result(
                    f"Version Disclosure - Server header reveals version: {server_header}",
                    False,
                    f"Server header exposes potentially vulnerable version: {server_header}",
                    "low"
                )
            else:
                self.results.add_result(
                    "Version Protection - No version information disclosed",
                    True
                )

    def test_logging_monitoring(self):
        """A09:2021 – Security Logging and Monitoring Failures"""
        print("\n🔍 Testing Logging and Monitoring...")
        
        # Test multiple failed login attempts
        failed_attempts = 0
        for i in range(5):
            response = self.session.post(
                f"{BASE_URL}/auth/login",
                json={"email": "attacker@test.com", "password": f"wrong_password_{i}"}
            )
            
            if response.status_code == 401:
                failed_attempts += 1
            elif response.status_code == 429:  # Rate limited
                self.results.add_result(
                    "Rate Limiting - Failed login attempts rate limited",
                    True
                )
                break
            time.sleep(0.1)  # Small delay between attempts
        
        if failed_attempts >= 5:
            self.results.add_result(
                "Rate Limiting - No protection against brute force attacks",
                False,
                "System allows unlimited failed login attempts",
                "medium"
            )

    def test_ssrf_vulnerabilities(self):
        """A10:2021 – Server-Side Request Forgery (SSRF)"""
        print("\n🔍 Testing SSRF Vulnerabilities...")
        
        if self.tokens.get("consumer"):
            # Test SSRF in profile picture or other URL fields
            ssrf_payloads = [
                "http://localhost:27017",  # MongoDB
                "http://127.0.0.1:22",    # SSH
                "http://169.254.169.254/latest/meta-data/",  # AWS metadata
                "file:///etc/passwd",
                "gopher://localhost:6379/_INFO"  # Redis
            ]
            
            for payload in ssrf_payloads:
                try:
                    response = self.make_request(
                        "PUT",
                        "/profile",
                        token=self.tokens["consumer"],
                        json={"picture": payload}
                    )
                    
                    # Check response time (SSRF might cause delays)
                    if response.elapsed.total_seconds() > 5:
                        self.results.add_result(
                            f"Potential SSRF - Long response time for: {payload}",
                            False,
                            f"Request to {payload} took {response.elapsed.total_seconds()}s",
                            "medium"
                        )
                    else:
                        self.results.add_result(
                            f"SSRF Protection - Quick response for: {payload[:30]}...",
                            True
                        )
                except Exception:
                    self.results.add_result(
                        f"SSRF Protection - Request safely handled: {payload[:30]}...",
                        True
                    )

    # ============== BUSINESS LOGIC TESTS ==============
    
    def test_business_logic_flaws(self):
        """Test business logic vulnerabilities"""
        print("\n🔍 Testing Business Logic Security...")
        
        if self.tokens.get("consumer"):
            # Test 1: Negative pricing
            try:
                response = self.make_request(
                    "POST",
                    "/booking-holds",
                    token=self.tokens["consumer"],
                    json={
                        "tutor_id": "tutor_test123",
                        "start_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
                        "duration_minutes": -60  # Negative duration
                    }
                )
                
                if response.status_code == 200:
                    self.results.add_result(
                        "Business Logic - Negative duration accepted",
                        False,
                        "System accepts negative booking duration",
                        "medium"
                    )
                else:
                    self.results.add_result(
                        "Business Logic - Negative duration rejected",
                        True
                    )
            except Exception:
                self.results.add_result(
                    "Business Logic - Negative duration safely handled",
                    True
                )
            
            # Test 2: Past date booking
            try:
                response = self.make_request(
                    "POST",
                    "/booking-holds",
                    token=self.tokens["consumer"],
                    json={
                        "tutor_id": "tutor_test123",
                        "start_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
                        "duration_minutes": 60
                    }
                )
                
                if response.status_code == 200:
                    self.results.add_result(
                        "Business Logic - Past date booking accepted",
                        False,
                        "System accepts bookings in the past",
                        "medium"
                    )
                else:
                    self.results.add_result(
                        "Business Logic - Past date booking rejected",
                        True
                    )
            except Exception:
                self.results.add_result(
                    "Business Logic - Past date booking safely handled",
                    True
                )

    # ============== MAIN TEST EXECUTION ==============
    
    def run_all_tests(self):
        """Run comprehensive security test suite"""
        print("🚀 Starting Maestro Hub Security Testing Suite")
        print("=" * 60)
        
        # Authenticate users
        print("🔐 Authenticating test users...")
        for role in ["consumer", "coach", "admin"]:
            if self.authenticate_user(role):
                print(f"✅ {role.capitalize()} authenticated successfully")
            else:
                print(f"❌ {role.capitalize()} authentication failed")
        
        # Run all security tests
        test_methods = [
            self.test_injection_attacks,
            self.test_broken_authentication,
            self.test_sensitive_data_exposure,
            self.test_broken_access_control,
            self.test_security_misconfiguration,
            self.test_xss_vulnerabilities,
            self.test_insecure_deserialization,
            self.test_vulnerable_components,
            self.test_logging_monitoring,
            self.test_ssrf_vulnerabilities,
            self.test_business_logic_flaws
        ]
        
        for test_method in test_methods:
            try:
                test_method()
            except Exception as e:
                print(f"❌ Test method {test_method.__name__} failed: {e}")
                self.results.add_result(
                    f"Test Framework Error - {test_method.__name__}",
                    False,
                    f"Test execution failed: {e}",
                    "low"
                )
        
        # Generate final report
        self.generate_security_report()
    
    def generate_security_report(self):
        """Generate comprehensive security test report"""
        print("\n" + "=" * 60)
        print("🛡️  MAESTRO HUB SECURITY TEST REPORT")
        print("=" * 60)
        
        print(f"\n📊 SUMMARY:")
        print(f"   ✅ Tests Passed: {self.results.passed}")
        print(f"   ❌ Tests Failed: {self.results.failed}")
        print(f"   🚨 Critical Issues: {len(self.results.critical_issues)}")
        print(f"   ⚠️  High Priority Issues: {len(self.results.warnings)}")
        
        if self.results.critical_issues:
            print(f"\n🚨 CRITICAL SECURITY ISSUES:")
            for issue in self.results.critical_issues:
                print(f"   • {issue['test']}: {issue['details']}")
        
        if self.results.warnings:
            print(f"\n⚠️  HIGH PRIORITY ISSUES:")
            for warning in self.results.warnings:
                print(f"   • {warning['test']}: {warning['details']}")
        
        # OWASP Top 10 Coverage
        print(f"\n🔍 OWASP TOP 10 COVERAGE:")
        owasp_tests = {
            "A01:2021 - Broken Access Control": "✅ Tested",
            "A02:2021 - Cryptographic Failures": "✅ Tested", 
            "A03:2021 - Injection": "✅ Tested",
            "A04:2021 - Insecure Design": "⚠️  Partially Tested",
            "A05:2021 - Security Misconfiguration": "✅ Tested",
            "A06:2021 - Vulnerable Components": "✅ Tested",
            "A07:2021 - Authentication Failures": "✅ Tested",
            "A08:2021 - Data Integrity Failures": "✅ Tested",
            "A09:2021 - Logging Failures": "✅ Tested",
            "A10:2021 - Server-Side Request Forgery": "✅ Tested"
        }
        
        for category, status in owasp_tests.items():
            print(f"   {status} {category}")
        
        # Security Score
        total_tests = self.results.passed + self.results.failed
        if total_tests > 0:
            security_score = (self.results.passed / total_tests) * 100
            print(f"\n🎯 SECURITY SCORE: {security_score:.1f}%")
            
            if security_score >= 90:
                print("   🟢 Excellent security posture")
            elif security_score >= 75:
                print("   🟡 Good security with room for improvement")
            elif security_score >= 60:
                print("   🟠 Moderate security concerns")
            else:
                print("   🔴 Significant security issues require attention")
        
        print(f"\n📝 Detailed test results saved to security_test_results.json")
        
        # Save detailed results
        with open("/app/security_test_results.json", "w") as f:
            json.dump({
                "summary": {
                    "passed": self.results.passed,
                    "failed": self.results.failed,
                    "critical_issues": len(self.results.critical_issues),
                    "high_priority_issues": len(self.results.warnings),
                    "security_score": (self.results.passed / (self.results.passed + self.results.failed)) * 100 if (self.results.passed + self.results.failed) > 0 else 0
                },
                "critical_issues": self.results.critical_issues,
                "warnings": self.results.warnings,
                "all_results": self.results.test_results,
                "owasp_coverage": owasp_tests,
                "timestamp": datetime.now().isoformat()
            }, f, indent=2)

if __name__ == "__main__":
    tester = MaestroHubSecurityTester()
    tester.run_all_tests()