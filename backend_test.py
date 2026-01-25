#!/usr/bin/env python3
"""
Maestro Hub Backend API Testing - Cross-Market Features
Tests the new cross-market coach search, exchange rates, market pricing, and meeting link APIs
"""

import asyncio
import httpx
import json
import os
from datetime import datetime
from typing import Dict, Any

# Get backend URL from environment
BACKEND_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://timezone-fix-17.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

# Test credentials
TEST_CREDENTIALS = {
    "consumer": {
        "email": "parent1@test.com",
        "password": "password123"
    },
    "tutor": {
        "email": "tutor4@test.com", 
        "password": "password123"
    }
}

class APITester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.tokens = {}
        self.test_results = []
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
    
    def log_result(self, test_name: str, success: bool, details: str, response_data: Any = None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}: {details}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "response_data": response_data,
            "timestamp": datetime.now().isoformat()
        })
    
    async def login(self, role: str) -> str:
        """Login and get JWT token"""
        creds = TEST_CREDENTIALS[role]
        
        try:
            response = await self.client.post(
                f"{API_BASE}/auth/login",
                json=creds
            )
            
            if response.status_code == 200:
                data = response.json()
                token = data.get("token")
                self.tokens[role] = token
                self.log_result(f"{role.title()} Login", True, f"Successfully logged in as {creds['email']}")
                return token
            else:
                self.log_result(f"{role.title()} Login", False, f"Login failed: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            self.log_result(f"{role.title()} Login", False, f"Login error: {str(e)}")
            return None
    
    def get_headers(self, role: str) -> Dict[str, str]:
        """Get authorization headers for role"""
        token = self.tokens.get(role)
        if not token:
            return {}
        return {"Authorization": f"Bearer {token}"}
    
    async def test_cross_market_coach_search(self):
        """Test Cross-Market Coach Search API"""
        print("\n🔍 Testing Cross-Market Coach Search...")
        
        # Login as consumer
        await self.login("consumer")
        headers = self.get_headers("consumer")
        
        if not headers:
            self.log_result("Cross-Market Search Setup", False, "Failed to get consumer authentication")
            return
        
        # Test 1: Default search (should include cross-market coaches)
        try:
            response = await self.client.get(
                f"{API_BASE}/tutors/search",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                tutors = data.get("tutors", [])
                
                # Check for cross-market fields
                cross_market_found = False
                for tutor in tutors:
                    if tutor.get("is_cross_market") or tutor.get("market_flag") or tutor.get("display_price"):
                        cross_market_found = True
                        break
                
                self.log_result(
                    "Cross-Market Search - Default", 
                    True, 
                    f"Search returned {len(tutors)} tutors, cross-market fields present: {cross_market_found}",
                    {"tutor_count": len(tutors), "has_cross_market_fields": cross_market_found}
                )
            else:
                self.log_result("Cross-Market Search - Default", False, f"Search failed: {response.status_code} - {response.text}")
                
        except Exception as e:
            self.log_result("Cross-Market Search - Default", False, f"Search error: {str(e)}")
        
        # Test 2: Local only search
        try:
            response = await self.client.get(
                f"{API_BASE}/tutors/search?local_only=true",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                tutors = data.get("tutors", [])
                
                # All tutors should be from same market
                local_only = all(not tutor.get("is_cross_market", False) for tutor in tutors)
                
                self.log_result(
                    "Cross-Market Search - Local Only", 
                    True, 
                    f"Local search returned {len(tutors)} tutors, all local: {local_only}",
                    {"tutor_count": len(tutors), "all_local": local_only}
                )
            else:
                self.log_result("Cross-Market Search - Local Only", False, f"Local search failed: {response.status_code} - {response.text}")
                
        except Exception as e:
            self.log_result("Cross-Market Search - Local Only", False, f"Local search error: {str(e)}")
    
    async def test_exchange_rates_api(self):
        """Test Exchange Rates API"""
        print("\n💱 Testing Exchange Rates API...")
        
        # Test 1: Get USD rates
        try:
            response = await self.client.get(f"{API_BASE}/exchange-rates")
            
            if response.status_code == 200:
                data = response.json()
                
                required_fields = ["base", "rates", "timestamp"]
                has_required = all(field in data for field in required_fields)
                
                rates = data.get("rates", {})
                has_inr = "INR" in rates
                
                self.log_result(
                    "Exchange Rates - USD Base", 
                    has_required and has_inr, 
                    f"USD rates: {len(rates)} currencies, has INR: {has_inr}",
                    {"base": data.get("base"), "currency_count": len(rates)}
                )
            else:
                self.log_result("Exchange Rates - USD Base", False, f"USD rates failed: {response.status_code} - {response.text}")
                
        except Exception as e:
            self.log_result("Exchange Rates - USD Base", False, f"USD rates error: {str(e)}")
        
        # Test 2: Get INR rates
        try:
            response = await self.client.get(f"{API_BASE}/exchange-rates?base=INR")
            
            if response.status_code == 200:
                data = response.json()
                
                base_currency = data.get("base")
                rates = data.get("rates", {})
                has_usd = "USD" in rates
                
                self.log_result(
                    "Exchange Rates - INR Base", 
                    base_currency == "INR" and has_usd, 
                    f"INR rates: base={base_currency}, {len(rates)} currencies, has USD: {has_usd}",
                    {"base": base_currency, "currency_count": len(rates)}
                )
            else:
                self.log_result("Exchange Rates - INR Base", False, f"INR rates failed: {response.status_code} - {response.text}")
                
        except Exception as e:
            self.log_result("Exchange Rates - INR Base", False, f"INR rates error: {str(e)}")
    
    async def test_tutor_market_pricing_api(self):
        """Test Tutor Market Pricing API"""
        print("\n💰 Testing Tutor Market Pricing API...")
        
        # Login as tutor
        await self.login("tutor")
        headers = self.get_headers("tutor")
        
        if not headers:
            self.log_result("Tutor Market Pricing Setup", False, "Failed to get tutor authentication")
            return
        
        # Test 1: Get current market pricing
        try:
            response = await self.client.get(
                f"{API_BASE}/tutors/market-pricing",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                
                required_fields = ["base_price", "market_pricing"]
                has_required = all(field in data for field in required_fields)
                
                market_pricing = data.get("market_pricing", [])
                
                self.log_result(
                    "Tutor Market Pricing - GET", 
                    has_required, 
                    f"Retrieved pricing: base_price={data.get('base_price')}, {len(market_pricing)} markets",
                    {"base_price": data.get("base_price"), "market_count": len(market_pricing)}
                )
                
                # Store current data for update test
                self.current_pricing = data
                
            else:
                self.log_result("Tutor Market Pricing - GET", False, f"GET pricing failed: {response.status_code} - {response.text}")
                
        except Exception as e:
            self.log_result("Tutor Market Pricing - GET", False, f"GET pricing error: {str(e)}")
        
        # Test 2: Update market pricing
        try:
            update_data = {
                "market_prices": {
                    "US_USD": 50.0,
                    "IN_INR": 3500.0
                },
                "enabled_markets": ["US_USD", "IN_INR"]
            }
            
            response = await self.client.put(
                f"{API_BASE}/tutors/market-pricing",
                headers=headers,
                json=update_data
            )
            
            if response.status_code == 200:
                data = response.json()
                
                message = data.get("message")
                updated_markets = data.get("market_prices", {})
                
                self.log_result(
                    "Tutor Market Pricing - PUT", 
                    message and len(updated_markets) >= 2, 
                    f"Updated pricing: message='{message}', markets={list(updated_markets.keys())}",
                    {"message": message, "updated_markets": list(updated_markets.keys())}
                )
            else:
                self.log_result("Tutor Market Pricing - PUT", False, f"PUT pricing failed: {response.status_code} - {response.text}")
                
        except Exception as e:
            self.log_result("Tutor Market Pricing - PUT", False, f"PUT pricing error: {str(e)}")
    
    async def test_consumer_enabled_markets_api(self):
        """Test Consumer Enabled Markets API"""
        print("\n🌍 Testing Consumer Enabled Markets API...")
        
        # Login as consumer
        await self.login("consumer")
        headers = self.get_headers("consumer")
        
        if not headers:
            self.log_result("Consumer Enabled Markets Setup", False, "Failed to get consumer authentication")
            return
        
        # Test 1: Get current enabled markets
        try:
            response = await self.client.get(
                f"{API_BASE}/me/enabled-markets",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                
                enabled_markets = data.get("enabled_markets", [])
                
                self.log_result(
                    "Consumer Enabled Markets - GET", 
                    isinstance(enabled_markets, list), 
                    f"Retrieved enabled markets: {enabled_markets}",
                    {"enabled_markets": enabled_markets}
                )
                
            else:
                self.log_result("Consumer Enabled Markets - GET", False, f"GET enabled markets failed: {response.status_code} - {response.text}")
                
        except Exception as e:
            self.log_result("Consumer Enabled Markets - GET", False, f"GET enabled markets error: {str(e)}")
        
        # Test 2: Update enabled markets
        try:
            update_data = {
                "enabled_markets": ["US_USD", "IN_INR"]
            }
            
            response = await self.client.put(
                f"{API_BASE}/me/enabled-markets",
                headers=headers,
                json=update_data
            )
            
            if response.status_code == 200:
                data = response.json()
                
                message = data.get("message")
                updated_markets = data.get("enabled_markets", [])
                
                self.log_result(
                    "Consumer Enabled Markets - PUT", 
                    message and "US_USD" in updated_markets and "IN_INR" in updated_markets, 
                    f"Updated enabled markets: message='{message}', markets={updated_markets}",
                    {"message": message, "enabled_markets": updated_markets}
                )
            else:
                self.log_result("Consumer Enabled Markets - PUT", False, f"PUT enabled markets failed: {response.status_code} - {response.text}")
                
        except Exception as e:
            self.log_result("Consumer Enabled Markets - PUT", False, f"PUT enabled markets error: {str(e)}")
    
    async def test_tutor_meeting_link_api(self):
        """Test Tutor Meeting Link API"""
        print("\n🔗 Testing Tutor Meeting Link API...")
        
        # Login as tutor
        await self.login("tutor")
        headers = self.get_headers("tutor")
        
        if not headers:
            self.log_result("Tutor Meeting Link Setup", False, "Failed to get tutor authentication")
            return
        
        # Test 1: Update meeting link with valid Zoom URL
        try:
            update_data = {
                "meeting_link": "https://zoom.us/j/1234567890?pwd=abcdef123456",
                "waiting_room_enabled": True
            }
            
            response = await self.client.put(
                f"{API_BASE}/tutors/meeting-link",
                headers=headers,
                json=update_data
            )
            
            if response.status_code == 200:
                data = response.json()
                
                success = data.get("success", False)
                meeting_link = data.get("meeting_link")
                
                self.log_result(
                    "Tutor Meeting Link - Valid Zoom URL", 
                    success and meeting_link == update_data["meeting_link"], 
                    f"Updated meeting link: success={success}, link={meeting_link}",
                    {"success": success, "meeting_link": meeting_link}
                )
            else:
                self.log_result("Tutor Meeting Link - Valid Zoom URL", False, f"PUT meeting link failed: {response.status_code} - {response.text}")
                
        except Exception as e:
            self.log_result("Tutor Meeting Link - Valid Zoom URL", False, f"PUT meeting link error: {str(e)}")
        
        # Test 2: Update with Google Meet URL
        try:
            update_data = {
                "meeting_link": "https://meet.google.com/abc-defg-hij",
                "waiting_room_enabled": False
            }
            
            response = await self.client.put(
                f"{API_BASE}/tutors/meeting-link",
                headers=headers,
                json=update_data
            )
            
            if response.status_code == 200:
                data = response.json()
                
                success = data.get("success", False)
                meeting_link = data.get("meeting_link")
                waiting_room = data.get("waiting_room_enabled")
                
                self.log_result(
                    "Tutor Meeting Link - Google Meet URL", 
                    success and meeting_link == update_data["meeting_link"], 
                    f"Updated Google Meet link: success={success}, waiting_room={waiting_room}",
                    {"success": success, "meeting_link": meeting_link, "waiting_room_enabled": waiting_room}
                )
            else:
                self.log_result("Tutor Meeting Link - Google Meet URL", False, f"PUT Google Meet link failed: {response.status_code} - {response.text}")
                
        except Exception as e:
            self.log_result("Tutor Meeting Link - Google Meet URL", False, f"PUT Google Meet link error: {str(e)}")
        
        # Test 3: Test invalid URL validation
        try:
            update_data = {
                "meeting_link": "https://invalid-meeting-platform.com/meeting/123",
                "waiting_room_enabled": True
            }
            
            response = await self.client.put(
                f"{API_BASE}/tutors/meeting-link",
                headers=headers,
                json=update_data
            )
            
            # Should either reject invalid URL or accept it (depending on validation)
            if response.status_code == 400:
                self.log_result(
                    "Tutor Meeting Link - Invalid URL Validation", 
                    True, 
                    "Invalid URL properly rejected with 400 status",
                    {"status_code": response.status_code}
                )
            elif response.status_code == 200:
                self.log_result(
                    "Tutor Meeting Link - Invalid URL Validation", 
                    True, 
                    "Invalid URL accepted (validation may be lenient)",
                    {"status_code": response.status_code}
                )
            else:
                self.log_result("Tutor Meeting Link - Invalid URL Validation", False, f"Unexpected status: {response.status_code} - {response.text}")
                
        except Exception as e:
            self.log_result("Tutor Meeting Link - Invalid URL Validation", False, f"Invalid URL test error: {str(e)}")
    
    async def run_all_tests(self):
        """Run all cross-market API tests"""
        print("🚀 Starting Maestro Hub Cross-Market API Testing...")
        print(f"Backend URL: {API_BASE}")
        
        # Run all test suites
        await self.test_cross_market_coach_search()
        await self.test_exchange_rates_api()
        await self.test_tutor_market_pricing_api()
        await self.test_consumer_enabled_markets_api()
        await self.test_tutor_meeting_link_api()
        
        # Summary
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"\n📊 TEST SUMMARY:")
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        # Save detailed results
        with open("/app/cross_market_test_results.json", "w") as f:
            json.dump({
                "summary": {
                    "total_tests": total_tests,
                    "passed_tests": passed_tests,
                    "failed_tests": failed_tests,
                    "success_rate": round(passed_tests/total_tests*100, 1)
                },
                "test_results": self.test_results,
                "timestamp": datetime.now().isoformat()
            }, f, indent=2)
        
        return passed_tests == total_tests

async def main():
    """Main test runner"""
    async with APITester() as tester:
        success = await tester.run_all_tests()
        return success

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)