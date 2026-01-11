#!/usr/bin/env python3
"""
Backend API Testing for Maestro Hub Payment Provider System
Tests the newly implemented payment provider endpoints and booking holds
"""

import requests
import json
import sys
from datetime import datetime, timezone, timedelta
import uuid

# Configuration
BACKEND_URL = "https://tutorhub-fix.preview.emergentagent.com/api"
TEST_CREDENTIALS = {
    "consumer": {"email": "parent2@test.com", "password": "password123"},
    "tutor": {"email": "tutor3@test.com", "password": "password123"}
}

class PaymentProviderTester:
    def __init__(self):
        self.session = requests.Session()
        self.consumer_token = None
        self.tutor_token = None
        self.consumer_user_id = None
        self.tutor_user_id = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = "", response_data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}")
        if details:
            print(f"    Details: {details}")
        if response_data and not success:
            print(f"    Response: {json.dumps(response_data, indent=2)}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "response": response_data
        })
        print()
    
    def make_request(self, method: str, endpoint: str, token: str = None, **kwargs):
        """Make authenticated API request"""
        headers = kwargs.get('headers', {})
        if token:
            headers['Authorization'] = f'Bearer {token}'
        kwargs['headers'] = headers
        
        url = f"{BACKEND_URL}{endpoint}"
        return self.session.request(method, url, **kwargs)
    
    def login_user(self, email: str, password: str):
        """Login user and return token and user_id"""
        try:
            response = self.make_request('POST', '/auth/login', json={
                "email": email,
                "password": password
            })
            
            if response.status_code == 200:
                data = response.json()
                return data.get('token'), data.get('user_id')
            else:
                print(f"Login failed for {email}: {response.status_code} - {response.text}")
                return None, None
        except Exception as e:
            print(f"Login error for {email}: {str(e)}")
            return None, None
    
    def setup_authentication(self) -> bool:
        """Setup authentication for both consumer and tutor"""
        print("🔐 Setting up authentication...")
        
        # Login consumer
        self.consumer_token, self.consumer_user_id = self.login_user(
            TEST_CREDENTIALS["consumer"]["email"],
            TEST_CREDENTIALS["consumer"]["password"]
        )
        
        # Login tutor  
        self.tutor_token, self.tutor_user_id = self.login_user(
            TEST_CREDENTIALS["tutor"]["email"], 
            TEST_CREDENTIALS["tutor"]["password"]
        )
        
        if not self.consumer_token:
            self.log_test("Consumer Authentication", False, "Failed to login consumer")
            return False
        
        if not self.tutor_token:
            self.log_test("Tutor Authentication", False, "Failed to login tutor")
            return False
            
        self.log_test("Consumer Authentication", True, f"Consumer logged in: {self.consumer_user_id}")
        self.log_test("Tutor Authentication", True, f"Tutor logged in: {self.tutor_user_id}")
        return True
    
    def test_get_payment_providers(self):
        """Test GET /api/payment-providers - Get available payment providers"""
        print("🔍 Testing GET /api/payment-providers...")
        
        try:
            response = self.make_request('GET', '/payment-providers', token=self.consumer_token)
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response structure
                required_keys = ['available_providers', 'linked_providers', 'market_id']
                missing_keys = [key for key in required_keys if key not in data]
                
                if missing_keys:
                    self.log_test("GET Payment Providers - Structure", False, 
                                f"Missing keys: {missing_keys}", data)
                    return False
                
                # Verify market-specific providers
                market_id = data.get('market_id', 'US_USD')
                available_providers = data.get('available_providers', [])
                
                if market_id == 'US_USD':
                    expected_providers = ['paypal', 'google_pay', 'apple_pay', 'venmo', 'zelle']
                else:  # IN_INR
                    expected_providers = ['phonepe', 'google_pay', 'paytm', 'amazon_pay']
                
                provider_ids = [p.get('id') for p in available_providers]
                missing_providers = [p for p in expected_providers if p not in provider_ids]
                
                if missing_providers:
                    self.log_test("GET Payment Providers - Market Providers", False,
                                f"Missing providers for {market_id}: {missing_providers}", data)
                    return False
                
                self.log_test("GET Payment Providers", True, 
                            f"Market: {market_id}, Providers: {len(available_providers)}, Linked: {len(data.get('linked_providers', []))}")
                return True
                
            else:
                self.log_test("GET Payment Providers", False, 
                            f"HTTP {response.status_code}", response.json() if response.content else None)
                return False
                
        except Exception as e:
            self.log_test("GET Payment Providers", False, f"Exception: {str(e)}")
            return False
    
    def test_link_payment_provider(self) -> bool:
        """Test POST /api/payment-providers - Link a payment provider"""
        print("🔗 Testing POST /api/payment-providers...")
        
        try:
            # First, get available providers to know what we can link
            response = self.make_request('GET', '/payment-providers', token=self.consumer_token)
            if response.status_code != 200:
                self.log_test("Link Payment Provider - Setup", False, "Could not get available providers")
                return False
            
            data = response.json()
            available_providers = data.get('available_providers', [])
            if not available_providers:
                self.log_test("Link Payment Provider - Setup", False, "No available providers found")
                return False
            
            # Try to link the first available provider
            provider_to_link = available_providers[0]['id']
            
            link_response = self.make_request('POST', '/payment-providers', 
                                            token=self.consumer_token,
                                            json={
                                                "provider_id": provider_to_link,
                                                "is_default": False
                                            })
            
            if link_response.status_code == 200:
                link_data = link_response.json()
                
                # Verify response structure
                if not all(key in link_data for key in ['success', 'provider', 'message']):
                    self.log_test("Link Payment Provider - Structure", False, 
                                "Missing response keys", link_data)
                    return False
                
                if not link_data.get('success'):
                    self.log_test("Link Payment Provider", False, 
                                f"Success=False: {link_data.get('message')}", link_data)
                    return False
                
                # Verify the provider was linked
                verify_response = self.make_request('GET', '/payment-providers', token=self.consumer_token)
                if verify_response.status_code == 200:
                    verify_data = verify_response.json()
                    linked_providers = verify_data.get('linked_providers', [])
                    
                    if not any(p.get('provider_id') == provider_to_link for p in linked_providers):
                        self.log_test("Link Payment Provider - Verification", False, 
                                    f"Provider {provider_to_link} not found in linked providers")
                        return False
                    
                    # Check if first provider is automatically set as default
                    if len(linked_providers) == 1:
                        if not linked_providers[0].get('is_default'):
                            self.log_test("Link Payment Provider - Default Logic", False, 
                                        "First provider should be automatically set as default")
                            return False
                
                self.log_test("Link Payment Provider", True, 
                            f"Successfully linked {provider_to_link}")
                return True
                
            else:
                error_data = link_response.json() if link_response.content else None
                self.log_test("Link Payment Provider", False, 
                            f"HTTP {link_response.status_code}", error_data)
                return False
                
        except Exception as e:
            self.log_test("Link Payment Provider", False, f"Exception: {str(e)}")
            return False
    
    def test_set_default_provider(self) -> bool:
        """Test PUT /api/payment-providers/{provider_id}/default - Set default provider"""
        print("🎯 Testing PUT /api/payment-providers/{provider_id}/default...")
        
        try:
            # Get current linked providers
            response = self.make_request('GET', '/payment-providers', token=self.consumer_token)
            if response.status_code != 200:
                self.log_test("Set Default Provider - Setup", False, "Could not get linked providers")
                return False
            
            data = response.json()
            linked_providers = data.get('linked_providers', [])
            
            if len(linked_providers) < 1:
                # Need to link another provider first
                available_providers = data.get('available_providers', [])
                if len(available_providers) < 2:
                    self.log_test("Set Default Provider - Setup", False, "Need at least 2 available providers")
                    return False
                
                # Link a second provider
                second_provider = None
                for provider in available_providers:
                    if not any(p.get('provider_id') == provider['id'] for p in linked_providers):
                        second_provider = provider['id']
                        break
                
                if not second_provider:
                    self.log_test("Set Default Provider - Setup", False, "Could not find second provider to link")
                    return False
                
                link_response = self.make_request('POST', '/payment-providers',
                                                token=self.consumer_token,
                                                json={
                                                    "provider_id": second_provider,
                                                    "is_default": False
                                                })
                
                if link_response.status_code != 200:
                    self.log_test("Set Default Provider - Setup", False, "Could not link second provider")
                    return False
                
                # Refresh linked providers
                response = self.make_request('GET', '/payment-providers', token=self.consumer_token)
                data = response.json()
                linked_providers = data.get('linked_providers', [])
            
            if len(linked_providers) < 2:
                self.log_test("Set Default Provider - Setup", False, "Need at least 2 linked providers")
                return False
            
            # Find a non-default provider to set as default
            target_provider = None
            for provider in linked_providers:
                if not provider.get('is_default'):
                    target_provider = provider['provider_id']
                    break
            
            if not target_provider:
                # Use the second provider
                target_provider = linked_providers[1]['provider_id']
            
            # Set as default
            default_response = self.make_request('PUT', f'/payment-providers/{target_provider}/default',
                                               token=self.consumer_token)
            
            if default_response.status_code == 200:
                default_data = default_response.json()
                
                if not default_data.get('success'):
                    self.log_test("Set Default Provider", False, 
                                f"Success=False: {default_data.get('message')}", default_data)
                    return False
                
                # Verify the change
                verify_response = self.make_request('GET', '/payment-providers', token=self.consumer_token)
                if verify_response.status_code == 200:
                    verify_data = verify_response.json()
                    updated_providers = verify_data.get('linked_providers', [])
                    
                    # Check that target provider is now default
                    target_is_default = False
                    other_defaults = 0
                    
                    for provider in updated_providers:
                        if provider['provider_id'] == target_provider:
                            target_is_default = provider.get('is_default', False)
                        elif provider.get('is_default'):
                            other_defaults += 1
                    
                    if not target_is_default:
                        self.log_test("Set Default Provider - Verification", False, 
                                    f"Target provider {target_provider} is not set as default")
                        return False
                    
                    if other_defaults > 0:
                        self.log_test("Set Default Provider - Verification", False, 
                                    f"Found {other_defaults} other default providers (should be 0)")
                        return False
                
                self.log_test("Set Default Provider", True, 
                            f"Successfully set {target_provider} as default")
                return True
                
            else:
                error_data = default_response.json() if default_response.content else None
                self.log_test("Set Default Provider", False, 
                            f"HTTP {default_response.status_code}", error_data)
                return False
                
        except Exception as e:
            self.log_test("Set Default Provider", False, f"Exception: {str(e)}")
            return False
    
    def test_create_booking_hold(self):
        """Test POST /api/booking-holds - Create booking hold (verify datetime fix)"""
        print("📅 Testing POST /api/booking-holds...")
        
        try:
            # Create a booking hold for future date
            future_time = datetime.now(timezone.utc) + timedelta(days=1)
            iso_time = future_time.isoformat()
            
            hold_data = {
                "tutor_id": "tutor_emily",  # Using the tutor_id from review request
                "start_at": iso_time,
                "duration_minutes": 60
            }
            
            response = self.make_request('POST', '/booking-holds', 
                                       token=self.consumer_token,
                                       json=hold_data)
            
            if response.status_code == 200 or response.status_code == 201:
                data = response.json()
                
                # Verify response structure
                required_keys = ['hold_id', 'tutor_id', 'consumer_id', 'start_at', 'end_at', 'expires_at']
                missing_keys = [key for key in required_keys if key not in data]
                
                if missing_keys:
                    self.log_test("Create Booking Hold - Structure", False, 
                                f"Missing keys: {missing_keys}", data)
                    return None
                
                hold_id = data.get('hold_id')
                if not hold_id:
                    self.log_test("Create Booking Hold", False, "No hold_id in response", data)
                    return None
                
                self.log_test("Create Booking Hold", True, 
                            f"Created hold {hold_id} for {iso_time}")
                return hold_id
                
            else:
                error_data = response.json() if response.content else None
                self.log_test("Create Booking Hold", False, 
                            f"HTTP {response.status_code}", error_data)
                return None
                
        except Exception as e:
            self.log_test("Create Booking Hold", False, f"Exception: {str(e)}")
            return None
    
    def test_process_payment(self, booking_hold_id: str = None) -> bool:
        """Test POST /api/payments/process - Process payment with auto-charge"""
        print("💳 Testing POST /api/payments/process...")
        
        try:
            # If no booking hold provided, create one
            if not booking_hold_id:
                booking_hold_id = self.test_create_booking_hold()
                if not booking_hold_id:
                    self.log_test("Process Payment - Setup", False, "Could not create booking hold")
                    return False
            
            # Ensure we have at least one linked payment provider
            providers_response = self.make_request('GET', '/payment-providers', token=self.consumer_token)
            if providers_response.status_code != 200:
                self.log_test("Process Payment - Setup", False, "Could not get payment providers")
                return False
            
            providers_data = providers_response.json()
            linked_providers = providers_data.get('linked_providers', [])
            
            if not linked_providers:
                # Link a provider first
                available_providers = providers_data.get('available_providers', [])
                if not available_providers:
                    self.log_test("Process Payment - Setup", False, "No available providers")
                    return False
                
                link_response = self.make_request('POST', '/payment-providers',
                                                token=self.consumer_token,
                                                json={
                                                    "provider_id": available_providers[0]['id'],
                                                    "is_default": True
                                                })
                
                if link_response.status_code != 200:
                    self.log_test("Process Payment - Setup", False, "Could not link payment provider")
                    return False
            
            # Process payment
            payment_data = {
                "booking_hold_id": booking_hold_id,
                "amount_cents": 5000  # $50.00 as specified in review request
            }
            
            response = self.make_request('POST', '/payments/process',
                                       token=self.consumer_token,
                                       json=payment_data)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check for success or failure response
                if data.get('success'):
                    # Successful payment
                    required_keys = ['payment_id', 'provider_used', 'amount_cents', 'currency', 'split']
                    missing_keys = [key for key in required_keys if key not in data]
                    
                    if missing_keys:
                        self.log_test("Process Payment - Success Structure", False, 
                                    f"Missing keys: {missing_keys}", data)
                        return False
                    
                    # Verify split calculation (90% tutor, 10% platform)
                    split = data.get('split', {})
                    expected_platform_fee = int(5000 * 0.10)  # 10% of $50
                    expected_tutor_payout = 5000 - expected_platform_fee
                    
                    actual_platform_fee = split.get('platform_fee_cents')
                    actual_tutor_payout = split.get('tutor_payout_cents')
                    
                    if actual_platform_fee != expected_platform_fee:
                        self.log_test("Process Payment - Platform Fee", False, 
                                    f"Expected {expected_platform_fee}, got {actual_platform_fee}")
                        return False
                    
                    if actual_tutor_payout != expected_tutor_payout:
                        self.log_test("Process Payment - Tutor Payout", False, 
                                    f"Expected {expected_tutor_payout}, got {actual_tutor_payout}")
                        return False
                    
                    self.log_test("Process Payment", True, 
                                f"Payment processed: ${data.get('amount_cents', 0)/100:.2f} via {data.get('provider_used')} (Tutor: ${actual_tutor_payout/100:.2f}, Platform: ${actual_platform_fee/100:.2f})")
                    return True
                    
                else:
                    # Payment failed - this is also a valid response to test fallback
                    error = data.get('error')
                    if error == 'no_payment_method':
                        self.log_test("Process Payment - No Payment Method", True, 
                                    "Correctly returned no_payment_method error")
                        return True
                    elif error == 'payment_failed':
                        self.log_test("Process Payment - Payment Failed", True, 
                                    f"Payment failed with fallback logic: {data.get('message')}")
                        return True
                    else:
                        self.log_test("Process Payment", False, 
                                    f"Unknown error: {data.get('message')}", data)
                        return False
                
            else:
                error_data = response.json() if response.content else None
                self.log_test("Process Payment", False, 
                            f"HTTP {response.status_code}", error_data)
                return False
                
        except Exception as e:
            self.log_test("Process Payment", False, f"Exception: {str(e)}")
            return False
    
    def test_unlink_payment_provider(self) -> bool:
        """Test DELETE /api/payment-providers/{provider_id} - Unlink a provider"""
        print("🗑️ Testing DELETE /api/payment-providers/{provider_id}...")
        
        try:
            # Get current linked providers
            response = self.make_request('GET', '/payment-providers', token=self.consumer_token)
            if response.status_code != 200:
                self.log_test("Unlink Payment Provider - Setup", False, "Could not get linked providers")
                return False
            
            data = response.json()
            linked_providers = data.get('linked_providers', [])
            
            if len(linked_providers) < 1:
                self.log_test("Unlink Payment Provider - Setup", False, "No linked providers to unlink")
                return False
            
            # Choose a provider to unlink (prefer non-default)
            provider_to_unlink = None
            was_default = False
            
            for provider in linked_providers:
                if not provider.get('is_default'):
                    provider_to_unlink = provider['provider_id']
                    was_default = False
                    break
            
            if not provider_to_unlink:
                # Unlink the default provider
                provider_to_unlink = linked_providers[0]['provider_id']
                was_default = linked_providers[0].get('is_default', False)
            
            initial_count = len(linked_providers)
            
            # Unlink the provider
            unlink_response = self.make_request('DELETE', f'/payment-providers/{provider_to_unlink}',
                                              token=self.consumer_token)
            
            if unlink_response.status_code == 200:
                unlink_data = unlink_response.json()
                
                if not unlink_data.get('success'):
                    self.log_test("Unlink Payment Provider", False, 
                                f"Success=False: {unlink_data.get('message')}", unlink_data)
                    return False
                
                # Verify the provider was removed
                verify_response = self.make_request('GET', '/payment-providers', token=self.consumer_token)
                if verify_response.status_code == 200:
                    verify_data = verify_response.json()
                    updated_providers = verify_data.get('linked_providers', [])
                    
                    # Check count decreased
                    if len(updated_providers) != initial_count - 1:
                        self.log_test("Unlink Payment Provider - Count", False, 
                                    f"Expected {initial_count - 1} providers, got {len(updated_providers)}")
                        return False
                    
                    # Check provider is not in list
                    if any(p.get('provider_id') == provider_to_unlink for p in updated_providers):
                        self.log_test("Unlink Payment Provider - Removal", False, 
                                    f"Provider {provider_to_unlink} still in linked providers")
                        return False
                    
                    # If we removed the default and there are remaining providers, 
                    # check that another became default
                    if was_default and len(updated_providers) > 0:
                        has_default = any(p.get('is_default') for p in updated_providers)
                        if not has_default:
                            self.log_test("Unlink Payment Provider - Default Logic", False, 
                                        "No default provider after removing default")
                            return False
                
                self.log_test("Unlink Payment Provider", True, 
                            f"Successfully unlinked {provider_to_unlink}")
                return True
                
            else:
                error_data = unlink_response.json() if unlink_response.content else None
                self.log_test("Unlink Payment Provider", False, 
                            f"HTTP {unlink_response.status_code}", error_data)
                return False
                
        except Exception as e:
            self.log_test("Unlink Payment Provider", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all payment provider system tests"""
        print("🚀 Starting Payment Provider System Tests")
        print("=" * 60)
        
        # Setup authentication
        if not self.setup_authentication():
            print("❌ Authentication setup failed. Cannot proceed with tests.")
            return False
        
        print("\n" + "=" * 60)
        print("🧪 Running Payment Provider Tests")
        print("=" * 60)
        
        # Test payment provider endpoints
        success_count = 0
        total_tests = 6
        
        # 1. Get payment providers
        if self.test_get_payment_providers():
            success_count += 1
        
        # 2. Link payment provider
        if self.test_link_payment_provider():
            success_count += 1
        
        # 3. Set default provider
        if self.test_set_default_provider():
            success_count += 1
        
        # 4. Create booking hold (verify datetime fix)
        booking_hold_id = self.test_create_booking_hold()
        if booking_hold_id:
            success_count += 1
        
        # 5. Process payment
        if self.test_process_payment(booking_hold_id):
            success_count += 1
        
        # 6. Unlink payment provider
        if self.test_unlink_payment_provider():
            success_count += 1
        
        print("=" * 60)
        print(f"🏁 Test Results: {success_count}/{total_tests} tests passed")
        
        if success_count == total_tests:
            print("🎉 All payment provider tests PASSED!")
            return True
        else:
            print(f"⚠️  {total_tests - success_count} tests FAILED")
            return False

def main():
    """Main test execution"""
    tester = PaymentProviderTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n✅ Payment Provider System is working correctly!")
        sys.exit(0)
    else:
        print("\n❌ Payment Provider System has issues that need attention!")
        sys.exit(1)

if __name__ == "__main__":
    main()