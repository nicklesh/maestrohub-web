#!/usr/bin/env python3
"""
Focused Security Testing - Debug JWT and Password Issues
"""

import requests
import json
import time

BASE_URL = "https://multilingual-tutors.preview.emergentagent.com/api"

def test_jwt_detailed():
    """Test JWT validation in detail"""
    print("🔍 Detailed JWT Testing...")
    
    test_cases = [
        ("invalid.token.here", "Invalid token format"),
        ("", "Empty token"),
        ("malformed", "Malformed token"),
        ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiZmFrZSIsImV4cCI6OTk5OTk5OTk5OX0.invalid_signature", "Invalid signature")
    ]
    
    for token, description in test_cases:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
        print(f"{description}: Status {response.status_code}, Response: {response.text[:100]}")

def test_password_detailed():
    """Test password validation in detail"""
    print("\n🔍 Detailed Password Testing...")
    
    test_cases = [
        ("", "Empty password"),
        ("123", "Short password"),
        ("password", "No uppercase"),
        ("PASSWORD", "No lowercase"),
        ("Password", "No number"),
        ("SecurePass123", "Valid password")
    ]
    
    for password, description in test_cases:
        email = f"test_{int(time.time())}_{hash(password) % 1000}@test.com"
        payload = {
            "email": email,
            "name": "Test User",
            "password": password,
            "role": "consumer"
        }
        
        response = requests.post(f"{BASE_URL}/auth/register", json=payload)
        print(f"{description}: Status {response.status_code}, Response: {response.text[:200]}")
        time.sleep(0.1)

def test_rate_limiting_detailed():
    """Test rate limiting in detail"""
    print("\n🔍 Detailed Rate Limiting Testing...")
    
    for i in range(8):
        payload = {
            "email": "nonexistent@test.com",
            "password": "wrongpassword"
        }
        
        response = requests.post(f"{BASE_URL}/auth/login", json=payload)
        print(f"Attempt {i+1}: Status {response.status_code}, Response: {response.text[:100]}")
        
        if response.status_code == 429:
            print("✅ Rate limiting triggered!")
            break
        
        time.sleep(0.1)

if __name__ == "__main__":
    test_jwt_detailed()
    test_password_detailed()
    test_rate_limiting_detailed()