#!/usr/bin/env python3
"""
Backend API Testing for Maestro Hub - Booking Tracking Features
Testing the new booking tracking features that were just implemented.
"""

import asyncio
import aiohttp
import json
import sys
from datetime import datetime, timezone
from typing import Dict, Any, Optional

# Backend URL from frontend/.env
BACKEND_URL = "https://coach-finder-27.preview.emergentagent.com/api"

# Test credentials provided in review request
TEST_CREDENTIALS = {
    "parent": {"email": "parent1@test.com", "password": "password123"},
    "coach": {"email": "tutor3@test.com", "password": "password123"},
    "admin": {"email": "admin@maestrohub.com", "password": "password123"}
}

class BookingTrackingTester:
    def __init__(self):
        self.session = None
        self.tokens = {}
        self.test_results = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_test(self, test_name: str, success: bool, details: str = "", data: Any = None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "success": success,
            "details": details,
            "data": data,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        print(f"{status} - {test_name}")
        if details:
            print(f"    {details}")
        if not success and data:
            print(f"    Response: {json.dumps(data, indent=2)}")
        print()
    
    async def login_user(self, role: str) -> Optional[str]:
        """Login user and return JWT token"""
        if role in self.tokens:
            return self.tokens[role]
            
        creds = TEST_CREDENTIALS.get(role)
        if not creds:
            self.log_test(f"Login {role}", False, f"No credentials found for role: {role}")
            return None
            
        try:
            async with self.session.post(
                f"{BACKEND_URL}/auth/login",
                json=creds,
                headers={"Content-Type": "application/json"}
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    token = data.get("token")
                    if token:
                        self.tokens[role] = token
                        self.log_test(f"Login {role}", True, f"Successfully logged in as {creds['email']}")
                        return token
                    else:
                        self.log_test(f"Login {role}", False, "No token in response", data)
                        return None
                else:
                    error_data = await resp.text()
                    self.log_test(f"Login {role}", False, f"HTTP {resp.status}: {error_data}")
                    return None
        except Exception as e:
            self.log_test(f"Login {role}", False, f"Exception: {str(e)}")
            return None
    
    async def make_request(self, method: str, endpoint: str, token: str, data: Dict = None) -> tuple[bool, Any]:
        """Make authenticated API request"""
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        try:
            url = f"{BACKEND_URL}{endpoint}"
            
            if method.upper() == "GET":
                async with self.session.get(url, headers=headers) as resp:
                    response_data = await resp.json() if resp.content_type == 'application/json' else await resp.text()
                    return resp.status == 200, response_data
            elif method.upper() == "POST":
                async with self.session.post(url, json=data, headers=headers) as resp:
                    response_data = await resp.json() if resp.content_type == 'application/json' else await resp.text()
                    return resp.status in [200, 201], response_data
            elif method.upper() == "PUT":
                async with self.session.put(url, json=data, headers=headers) as resp:
                    response_data = await resp.json() if resp.content_type == 'application/json' else await resp.text()
                    return resp.status == 200, response_data
            else:
                return False, f"Unsupported method: {method}"
                
        except Exception as e:
            return False, f"Request exception: {str(e)}"
    
    async def test_consumer_bookings_api(self):
        """Test 1: Consumer Bookings API - GET /api/bookings includes rescheduled field"""
        print("🔍 Testing Consumer Bookings API...")
        
        token = await self.login_user("parent")
        if not token:
            return
        
        success, data = await self.make_request("GET", "/bookings", token)
        
        if not success:
            self.log_test("Consumer Bookings API", False, "Failed to fetch bookings", data)
            return
        
        # Check if response is a list of bookings
        if not isinstance(data, list):
            self.log_test("Consumer Bookings API", False, "Response is not a list", data)
            return
        
        # Check if bookings have rescheduled field
        has_rescheduled_field = False
        booking_count = len(data)
        
        if booking_count == 0:
            self.log_test("Consumer Bookings API", True, "No bookings found, but API structure is correct", {"booking_count": 0})
            return
        
        # Check first few bookings for rescheduled field
        for i, booking in enumerate(data[:3]):  # Check first 3 bookings
            if "rescheduled" in booking:
                has_rescheduled_field = True
                break
        
        if has_rescheduled_field:
            self.log_test("Consumer Bookings API", True, 
                         f"Found {booking_count} bookings with rescheduled field present",
                         {"sample_booking_keys": list(data[0].keys()) if data else []})
        else:
            self.log_test("Consumer Bookings API", False, 
                         f"rescheduled field missing from booking objects",
                         {"sample_booking": data[0] if data else None})
    
    async def test_consumer_reports_api(self):
        """Test 2: Consumer Reports API - GET /api/reports/consumer returns tracking fields"""
        print("🔍 Testing Consumer Reports API...")
        
        token = await self.login_user("parent")
        if not token:
            return
        
        success, data = await self.make_request("GET", "/reports/consumer", token)
        
        if not success:
            self.log_test("Consumer Reports API", False, "Failed to fetch consumer report", data)
            return
        
        # Check if response has summary section
        if not isinstance(data, dict) or "summary" not in data:
            self.log_test("Consumer Reports API", False, "Response missing summary section", data)
            return
        
        summary = data["summary"]
        required_fields = ["rescheduled_sessions", "canceled_sessions", "canceled_amount_cents"]
        missing_fields = []
        
        for field in required_fields:
            if field not in summary:
                missing_fields.append(field)
        
        if missing_fields:
            self.log_test("Consumer Reports API", False, 
                         f"Missing required fields in summary: {missing_fields}",
                         {"summary_keys": list(summary.keys())})
        else:
            self.log_test("Consumer Reports API", True, 
                         "All required tracking fields present in summary",
                         {
                             "rescheduled_sessions": summary.get("rescheduled_sessions"),
                             "canceled_sessions": summary.get("canceled_sessions"),
                             "canceled_amount_cents": summary.get("canceled_amount_cents")
                         })
    
    async def test_provider_reports_api(self):
        """Test 3: Provider Reports API - GET /api/reports/provider returns tracking fields"""
        print("🔍 Testing Provider Reports API...")
        
        token = await self.login_user("coach")
        if not token:
            return
        
        success, data = await self.make_request("GET", "/reports/provider", token)
        
        if not success:
            self.log_test("Provider Reports API", False, "Failed to fetch provider report", data)
            return
        
        # Check if response has summary section
        if not isinstance(data, dict) or "summary" not in data:
            self.log_test("Provider Reports API - Summary", False, "Response missing summary section", data)
            return
        
        summary = data["summary"]
        required_summary_fields = ["rescheduled_sessions", "canceled_sessions", "canceled_amount_cents"]
        missing_summary_fields = []
        
        for field in required_summary_fields:
            if field not in summary:
                missing_summary_fields.append(field)
        
        summary_success = len(missing_summary_fields) == 0
        
        if summary_success:
            self.log_test("Provider Reports API - Summary", True, 
                         "All required tracking fields present in summary",
                         {
                             "rescheduled_sessions": summary.get("rescheduled_sessions"),
                             "canceled_sessions": summary.get("canceled_sessions"),
                             "canceled_amount_cents": summary.get("canceled_amount_cents")
                         })
        else:
            self.log_test("Provider Reports API - Summary", False, 
                         f"Missing required fields in summary: {missing_summary_fields}",
                         {"summary_keys": list(summary.keys())})
        
        # Check by_consumer array
        if "by_consumer" not in data:
            self.log_test("Provider Reports API - by_consumer", False, "Response missing by_consumer array", data)
            return
        
        by_consumer = data["by_consumer"]
        if not isinstance(by_consumer, list):
            self.log_test("Provider Reports API - by_consumer", False, "by_consumer is not an array", by_consumer)
            return
        
        if len(by_consumer) == 0:
            self.log_test("Provider Reports API - by_consumer", True, "by_consumer array is empty but structure is correct")
            return
        
        # Check first consumer entry for required fields
        consumer_entry = by_consumer[0]
        required_consumer_fields = ["consumer_name", "status", "total_sessions", "month_sessions", "rescheduled_sessions", "canceled_sessions"]
        missing_consumer_fields = []
        
        for field in required_consumer_fields:
            if field not in consumer_entry:
                missing_consumer_fields.append(field)
        
        if missing_consumer_fields:
            self.log_test("Provider Reports API - by_consumer", False, 
                         f"Missing required fields in by_consumer entries: {missing_consumer_fields}",
                         {"sample_consumer_keys": list(consumer_entry.keys())})
        else:
            self.log_test("Provider Reports API - by_consumer", True, 
                         f"All required fields present in by_consumer array ({len(by_consumer)} consumers)",
                         {
                             "sample_consumer": {
                                 "consumer_name": consumer_entry.get("consumer_name"),
                                 "status": consumer_entry.get("status"),
                                 "total_sessions": consumer_entry.get("total_sessions"),
                                 "month_sessions": consumer_entry.get("month_sessions"),
                                 "rescheduled_sessions": consumer_entry.get("rescheduled_sessions"),
                                 "canceled_sessions": consumer_entry.get("canceled_sessions")
                             }
                         })
    
    async def test_admin_reports_api(self):
        """Test 4: Admin Reports API - GET /api/admin/reports/overview returns tracking stats"""
        print("🔍 Testing Admin Reports API...")
        
        token = await self.login_user("admin")
        if not token:
            return
        
        success, data = await self.make_request("GET", "/admin/reports/overview", token)
        
        if not success:
            self.log_test("Admin Reports API", False, "Failed to fetch admin reports overview", data)
            return
        
        # Check if response has stats section
        if not isinstance(data, dict) or "stats" not in data:
            self.log_test("Admin Reports API", False, "Response missing stats section", data)
            return
        
        stats = data["stats"]
        required_fields = ["canceled_bookings", "rescheduled_bookings", "canceled_revenue_cents"]
        missing_fields = []
        
        for field in required_fields:
            if field not in stats:
                missing_fields.append(field)
        
        if missing_fields:
            self.log_test("Admin Reports API", False, 
                         f"Missing required fields in stats: {missing_fields}",
                         {"stats_keys": list(stats.keys())})
        else:
            self.log_test("Admin Reports API", True, 
                         "All required tracking fields present in stats",
                         {
                             "canceled_bookings": stats.get("canceled_bookings"),
                             "rescheduled_bookings": stats.get("rescheduled_bookings"),
                             "canceled_revenue_cents": stats.get("canceled_revenue_cents")
                         })
    
    async def run_all_tests(self):
        """Run all booking tracking tests"""
        print("🚀 Starting Booking Tracking Features Testing...")
        print("=" * 60)
        
        # Test all endpoints
        await self.test_consumer_bookings_api()
        await self.test_consumer_reports_api()
        await self.test_provider_reports_api()
        await self.test_admin_reports_api()
        
        # Summary
        print("=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r["success"]])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        print()
        
        if failed_tests > 0:
            print("❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
            print()
        
        print("✅ PASSED TESTS:")
        for result in self.test_results:
            if result["success"]:
                print(f"  - {result['test']}")
        
        return passed_tests == total_tests

async def main():
    """Main test runner"""
    async with BookingTrackingTester() as tester:
        success = await tester.run_all_tests()
        
        # Save detailed results
        with open("/app/booking_tracking_test_results.json", "w") as f:
            json.dump({
                "test_run": {
                    "timestamp": datetime.now().isoformat(),
                    "backend_url": BACKEND_URL,
                    "total_tests": len(tester.test_results),
                    "passed": len([r for r in tester.test_results if r["success"]]),
                    "failed": len([r for r in tester.test_results if not r["success"]]),
                    "success_rate": len([r for r in tester.test_results if r["success"]]) / len(tester.test_results) * 100
                },
                "results": tester.test_results
            }, f, indent=2)
        
        return 0 if success else 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)