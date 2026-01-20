#!/usr/bin/env python3
"""
Backend API Testing for Maestro Hub Multi-Market Endpoints
Tests the new multi-market API endpoints as requested in the review.
"""

import requests
import json
import uuid
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Get backend URL from environment
BACKEND_URL = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'https://coach-translate.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

class TestSession:
    def __init__(self):
        self.session = requests.Session()
        self.consumer_token = None
        self.tutor_token = None
        self.admin_token = None
        self.consumer_user_id = None
        self.tutor_user_id = None
        self.tutor_id = None
        
    def log_test(self, test_name, success, details=""):
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
        print()

def test_market_configuration():
    """Test Market Configuration endpoints (MKT-01)"""
    print("=== Testing Market Configuration (MKT-01) ===")
    
    # Test 1: GET /api/markets - Should return US_USD and IN_INR markets
    try:
        response = requests.get(f"{API_BASE}/markets")
        success = response.status_code == 200
        if success:
            data = response.json()
            markets = data.get('markets', [])
            market_ids = [m['market_id'] for m in markets]
            success = 'US_USD' in market_ids and 'IN_INR' in market_ids
            details = f"Found markets: {market_ids}" if success else f"Expected US_USD and IN_INR, got: {market_ids}"
        else:
            details = f"Status: {response.status_code}, Response: {response.text}"
        
        test_session.log_test("GET /api/markets", success, details)
    except Exception as e:
        test_session.log_test("GET /api/markets", False, f"Exception: {str(e)}")
    
    # Test 2: GET /api/markets/US_USD - Should return US market details
    try:
        response = requests.get(f"{API_BASE}/markets/US_USD")
        success = response.status_code == 200
        if success:
            data = response.json()
            success = data.get('market_id') == 'US_USD' and data.get('currency') == 'USD'
            details = f"Market ID: {data.get('market_id')}, Currency: {data.get('currency')}"
        else:
            details = f"Status: {response.status_code}, Response: {response.text}"
        
        test_session.log_test("GET /api/markets/US_USD", success, details)
    except Exception as e:
        test_session.log_test("GET /api/markets/US_USD", False, f"Exception: {str(e)}")
    
    # Test 3: GET /api/markets/IN_INR - Should return India market details
    try:
        response = requests.get(f"{API_BASE}/markets/IN_INR")
        success = response.status_code == 200
        if success:
            data = response.json()
            success = data.get('market_id') == 'IN_INR' and data.get('currency') == 'INR'
            details = f"Market ID: {data.get('market_id')}, Currency: {data.get('currency')}"
        else:
            details = f"Status: {response.status_code}, Response: {response.text}"
        
        test_session.log_test("GET /api/markets/IN_INR", success, details)
    except Exception as e:
        test_session.log_test("GET /api/markets/IN_INR", False, f"Exception: {str(e)}")
    
    # Test 4: GET /api/markets/INVALID - Should return 404
    try:
        response = requests.get(f"{API_BASE}/markets/INVALID")
        success = response.status_code == 404
        details = f"Status: {response.status_code}" + (f", Response: {response.text}" if not success else "")
        
        test_session.log_test("GET /api/markets/INVALID (should 404)", success, details)
    except Exception as e:
        test_session.log_test("GET /api/markets/INVALID (should 404)", False, f"Exception: {str(e)}")

def test_geo_detection():
    """Test Geo Detection endpoint (MKT-02)"""
    print("=== Testing Geo Detection (MKT-02) ===")
    
    try:
        response = requests.get(f"{API_BASE}/geo/detect")
        success = response.status_code == 200
        if success:
            data = response.json()
            required_fields = ['detected_country', 'suggested_market_id', 'ip', 'source']
            success = all(field in data for field in required_fields)
            details = f"Country: {data.get('detected_country')}, Market: {data.get('suggested_market_id')}, Source: {data.get('source')}"
        else:
            details = f"Status: {response.status_code}, Response: {response.text}"
        
        test_session.log_test("GET /api/geo/detect", success, details)
    except Exception as e:
        test_session.log_test("GET /api/geo/detect", False, f"Exception: {str(e)}")

def test_consumer_market_selection():
    """Test Consumer Market Selection (MKT-02)"""
    print("=== Testing Consumer Market Selection (MKT-02) ===")
    
    # Test 6: Register a new consumer user
    try:
        user_email = f"consumer_{uuid.uuid4().hex[:8]}@test.com"
        user_data = {
            "email": user_email,
            "password": "testpass123",
            "name": "Test Consumer",
            "role": "consumer"
        }
        
        response = requests.post(f"{API_BASE}/auth/register", json=user_data)
        success = response.status_code == 200
        if success:
            data = response.json()
            test_session.consumer_token = data.get('token')
            test_session.consumer_user_id = data.get('user_id')
            success = test_session.consumer_token is not None
            details = f"User ID: {test_session.consumer_user_id}, Role: {data.get('role')}"
        else:
            details = f"Status: {response.status_code}, Response: {response.text}"
        
        test_session.log_test("POST /api/auth/register (consumer)", success, details)
    except Exception as e:
        test_session.log_test("POST /api/auth/register (consumer)", False, f"Exception: {str(e)}")
        return
    
    if not test_session.consumer_token:
        print("❌ Cannot continue consumer market tests without token")
        return
    
    # Test 7: GET /api/me/market - Should show needs_selection: true
    try:
        headers = {"Authorization": f"Bearer {test_session.consumer_token}"}
        response = requests.get(f"{API_BASE}/me/market", headers=headers)
        success = response.status_code == 200
        if success:
            data = response.json()
            success = data.get('needs_selection') == True and data.get('market_id') is None
            details = f"Needs selection: {data.get('needs_selection')}, Market ID: {data.get('market_id')}"
        else:
            details = f"Status: {response.status_code}, Response: {response.text}"
        
        test_session.log_test("GET /api/me/market (before selection)", success, details)
    except Exception as e:
        test_session.log_test("GET /api/me/market (before selection)", False, f"Exception: {str(e)}")
    
    # Test 8: POST /api/me/market with {"market_id": "US_USD"} - Should set consumer market
    try:
        headers = {"Authorization": f"Bearer {test_session.consumer_token}"}
        market_data = {"market_id": "US_USD"}
        response = requests.post(f"{API_BASE}/me/market", json=market_data, headers=headers)
        success = response.status_code == 200
        if success:
            data = response.json()
            success = data.get('market_id') == 'US_USD'
            details = f"Set market to: {data.get('market_id')}"
        else:
            details = f"Status: {response.status_code}, Response: {response.text}"
        
        test_session.log_test("POST /api/me/market (set US_USD)", success, details)
    except Exception as e:
        test_session.log_test("POST /api/me/market (set US_USD)", False, f"Exception: {str(e)}")
    
    # Test 9: GET /api/me/market - Should show market_id: US_USD, needs_selection: false
    try:
        headers = {"Authorization": f"Bearer {test_session.consumer_token}"}
        response = requests.get(f"{API_BASE}/me/market", headers=headers)
        success = response.status_code == 200
        if success:
            data = response.json()
            success = data.get('market_id') == 'US_USD' and data.get('needs_selection') == False
            details = f"Market ID: {data.get('market_id')}, Needs selection: {data.get('needs_selection')}"
        else:
            details = f"Status: {response.status_code}, Response: {response.text}"
        
        test_session.log_test("GET /api/me/market (after selection)", success, details)
    except Exception as e:
        test_session.log_test("GET /api/me/market (after selection)", False, f"Exception: {str(e)}")

def test_provider_market():
    """Test Provider Market endpoints (MKT-03)"""
    print("=== Testing Provider Market (MKT-03) ===")
    
    # Test 10: Register as tutor
    try:
        tutor_email = f"tutor_{uuid.uuid4().hex[:8]}@test.com"
        user_data = {
            "email": tutor_email,
            "password": "testpass123",
            "name": "Test Tutor",
            "role": "tutor"
        }
        
        response = requests.post(f"{API_BASE}/auth/register", json=user_data)
        success = response.status_code == 200
        if success:
            data = response.json()
            test_session.tutor_token = data.get('token')
            test_session.tutor_user_id = data.get('user_id')
            success = test_session.tutor_token is not None
            details = f"User ID: {test_session.tutor_user_id}, Role: {data.get('role')}"
        else:
            details = f"Status: {response.status_code}, Response: {response.text}"
        
        test_session.log_test("POST /api/auth/register (tutor)", success, details)
    except Exception as e:
        test_session.log_test("POST /api/auth/register (tutor)", False, f"Exception: {str(e)}")
        return
    
    if not test_session.tutor_token:
        print("❌ Cannot continue provider market tests without token")
        return
    
    # Test 11: Create tutor profile
    try:
        headers = {"Authorization": f"Bearer {test_session.tutor_token}"}
        profile_data = {
            "bio": "Experienced math tutor with 5+ years of teaching experience",
            "categories": ["academic"],
            "subjects": ["Math", "Algebra", "Calculus"],
            "levels": ["high_school", "college"],
            "modality": ["online", "in_person"],
            "service_area_radius": 15,
            "base_price": 50.0,
            "duration_minutes": 60,
            "policies": {
                "cancel_window_hours": 24,
                "no_show_policy": "Full charge for no-shows",
                "late_arrival_policy": "Lesson time not extended"
            }
        }
        
        response = requests.post(f"{API_BASE}/tutors/profile", json=profile_data, headers=headers)
        success = response.status_code == 200
        if success:
            data = response.json()
            test_session.tutor_id = data.get('tutor_id')
            success = test_session.tutor_id is not None
            details = f"Tutor ID: {test_session.tutor_id}, Status: {data.get('status')}"
        else:
            details = f"Status: {response.status_code}, Response: {response.text}"
        
        test_session.log_test("POST /api/tutors/profile", success, details)
    except Exception as e:
        test_session.log_test("POST /api/tutors/profile", False, f"Exception: {str(e)}")
        return
    
    # Test 12: POST /api/providers/market with {"payout_country": "IN"} - Should set market to IN_INR
    try:
        headers = {"Authorization": f"Bearer {test_session.tutor_token}"}
        market_data = {"payout_country": "IN"}
        response = requests.post(f"{API_BASE}/providers/market", json=market_data, headers=headers)
        success = response.status_code == 200
        if success:
            data = response.json()
            success = data.get('market_id') == 'IN_INR' and data.get('payout_country') == 'IN'
            details = f"Market ID: {data.get('market_id')}, Payout Country: {data.get('payout_country')}"
        else:
            details = f"Status: {response.status_code}, Response: {response.text}"
        
        test_session.log_test("POST /api/providers/market (set IN)", success, details)
    except Exception as e:
        test_session.log_test("POST /api/providers/market (set IN)", False, f"Exception: {str(e)}")
    
    # Test 13: GET /api/providers/market - Should show market_id: IN_INR
    try:
        headers = {"Authorization": f"Bearer {test_session.tutor_token}"}
        response = requests.get(f"{API_BASE}/providers/market", headers=headers)
        success = response.status_code == 200
        if success:
            data = response.json()
            success = data.get('market_id') == 'IN_INR'
            details = f"Market ID: {data.get('market_id')}, Payout Country: {data.get('payout_country')}"
        else:
            details = f"Status: {response.status_code}, Response: {response.text}"
        
        test_session.log_test("GET /api/providers/market", success, details)
    except Exception as e:
        test_session.log_test("GET /api/providers/market", False, f"Exception: {str(e)}")

def test_pricing_policies():
    """Test Pricing Policies endpoints (MKT-06)"""
    print("=== Testing Pricing Policies (MKT-06) ===")
    
    # Test 14: GET /api/pricing-policies/US_USD - Should return pricing policy
    try:
        response = requests.get(f"{API_BASE}/pricing-policies/US_USD")
        success = response.status_code == 200
        if success:
            data = response.json()
            success = data.get('market_id') == 'US_USD'
            details = f"Market ID: {data.get('market_id')}, Trial days: {data.get('trial_days')}"
        else:
            details = f"Status: {response.status_code}, Response: {response.text}"
        
        test_session.log_test("GET /api/pricing-policies/US_USD", success, details)
    except Exception as e:
        test_session.log_test("GET /api/pricing-policies/US_USD", False, f"Exception: {str(e)}")
    
    # Test 15: GET /api/pricing-policies/IN_INR - Should return pricing policy
    try:
        response = requests.get(f"{API_BASE}/pricing-policies/IN_INR")
        success = response.status_code == 200
        if success:
            data = response.json()
            success = data.get('market_id') == 'IN_INR'
            details = f"Market ID: {data.get('market_id')}, Trial days: {data.get('trial_days')}"
        else:
            details = f"Status: {response.status_code}, Response: {response.text}"
        
        test_session.log_test("GET /api/pricing-policies/IN_INR", success, details)
    except Exception as e:
        test_session.log_test("GET /api/pricing-policies/IN_INR", False, f"Exception: {str(e)}")

def test_search_with_market_filter():
    """Test Search with Market Filter (MKT-04)"""
    print("=== Testing Search with Market Filter (MKT-04) ===")
    
    # Test 16: As US consumer, GET /api/tutors/search - Should only show US tutors (if market filter is active)
    try:
        headers = {"Authorization": f"Bearer {test_session.consumer_token}"} if test_session.consumer_token else {}
        response = requests.get(f"{API_BASE}/tutors/search", headers=headers)
        success = response.status_code == 200
        if success:
            data = response.json()
            tutors = data.get('tutors', [])
            # Check if market filtering is working (all tutors should be from US market if filter is active)
            us_tutors = [t for t in tutors if t.get('market_id') == 'US_USD']
            non_us_tutors = [t for t in tutors if t.get('market_id') != 'US_USD' and t.get('market_id') is not None]
            
            details = f"Total tutors: {len(tutors)}, US tutors: {len(us_tutors)}, Non-US tutors: {len(non_us_tutors)}"
            # Success if either no tutors found or all tutors are US-based (market filter working)
            success = len(tutors) == 0 or len(non_us_tutors) == 0
        else:
            details = f"Status: {response.status_code}, Response: {response.text}"
        
        test_session.log_test("GET /api/tutors/search (US consumer)", success, details)
    except Exception as e:
        test_session.log_test("GET /api/tutors/search (US consumer)", False, f"Exception: {str(e)}")

def test_admin_endpoints():
    """Test Admin endpoints"""
    print("=== Testing Admin Endpoints ===")
    
    # First, try to create an admin user
    try:
        admin_email = f"admin_{uuid.uuid4().hex[:8]}@test.com"
        user_data = {
            "email": admin_email,
            "password": "adminpass123",
            "name": "Test Admin",
            "role": "admin"
        }
        
        response = requests.post(f"{API_BASE}/auth/register", json=user_data)
        success = response.status_code == 200
        if success:
            data = response.json()
            test_session.admin_token = data.get('token')
            details = f"Admin user created: {data.get('user_id')}"
        else:
            details = f"Status: {response.status_code}, Response: {response.text}"
        
        test_session.log_test("Create admin user", success, details)
    except Exception as e:
        test_session.log_test("Create admin user", False, f"Exception: {str(e)}")
    
    if not test_session.admin_token:
        print("❌ Cannot test admin endpoints without admin token")
        return
    
    # Test 17: GET /api/admin/markets - Should return markets with stats
    try:
        headers = {"Authorization": f"Bearer {test_session.admin_token}"}
        response = requests.get(f"{API_BASE}/admin/markets", headers=headers)
        success = response.status_code == 200
        if success:
            data = response.json()
            markets = data.get('markets', [])
            success = len(markets) > 0 and all('stats' in m for m in markets)
            details = f"Found {len(markets)} markets with stats"
        else:
            details = f"Status: {response.status_code}, Response: {response.text}"
        
        test_session.log_test("GET /api/admin/markets", success, details)
    except Exception as e:
        test_session.log_test("GET /api/admin/markets", False, f"Exception: {str(e)}")
    
    # Test 18: GET /api/admin/analytics/markets - Should return market analytics
    try:
        headers = {"Authorization": f"Bearer {test_session.admin_token}"}
        response = requests.get(f"{API_BASE}/admin/analytics/markets", headers=headers)
        # This endpoint might not be implemented, so we'll check if it exists
        if response.status_code == 404:
            success = False
            details = "Endpoint not implemented (404)"
        else:
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Response keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}"
        
        test_session.log_test("GET /api/admin/analytics/markets", success, details)
    except Exception as e:
        test_session.log_test("GET /api/admin/analytics/markets", False, f"Exception: {str(e)}")

def run_all_tests():
    """Run all multi-market API tests"""
    print("🚀 Starting Maestro Hub Multi-Market API Tests")
    print(f"Backend URL: {API_BASE}")
    print("=" * 60)
    
    # Run tests in order as specified in the review request
    test_market_configuration()
    test_geo_detection()
    test_consumer_market_selection()
    test_provider_market()
    test_pricing_policies()
    test_search_with_market_filter()
    test_admin_endpoints()
    
    print("=" * 60)
    print("🏁 Multi-Market API Testing Complete")

if __name__ == "__main__":
    test_session = TestSession()
    run_all_tests()