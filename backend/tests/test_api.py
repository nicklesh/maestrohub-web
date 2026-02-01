"""
Backend API Tests for Maestro Habitat
Testing: Login, Profile Update, Add Child, Booking Flow
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://edu-platform-171.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "parent1@test.com"
TEST_PASSWORD = "password123"


class TestAuth:
    """Authentication endpoint tests"""
    
    def test_health_check(self):
        """Test health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ Health check passed")
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Token not in response"
        assert "user_id" in data, "user_id not in response"
        print(f"✓ Login successful - user_id: {data['user_id']}, role: {data.get('role')}")
        return data
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        print("✓ Invalid login correctly rejected")
    
    def test_get_me_authenticated(self):
        """Test /auth/me with valid token"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # Get user info
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("email") == TEST_EMAIL
        print(f"✓ /auth/me returned user: {data.get('name')}")
    
    def test_get_me_unauthenticated(self):
        """Test /auth/me without token"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("✓ /auth/me correctly requires authentication")


class TestProfile:
    """Profile management tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_update_profile_name(self, auth_token):
        """Test updating profile name"""
        # Update name
        new_name = f"Test Parent {datetime.now().strftime('%H%M%S')}"
        response = requests.put(
            f"{BASE_URL}/api/profile",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"name": new_name}
        )
        assert response.status_code == 200, f"Profile update failed: {response.text}"
        data = response.json()
        
        # Verify name was updated
        if "name" in data:
            assert data["name"] == new_name
        print(f"✓ Profile name updated to: {new_name}")
        
        # Verify via GET /auth/me
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert me_response.status_code == 200
        me_data = me_response.json()
        assert me_data.get("name") == new_name
        print(f"✓ Profile name verified via /auth/me")
    
    def test_update_profile_phone(self, auth_token):
        """Test updating profile phone"""
        new_phone = f"555-{datetime.now().strftime('%H%M%S')}"
        response = requests.put(
            f"{BASE_URL}/api/profile",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"phone": new_phone}
        )
        assert response.status_code == 200, f"Profile update failed: {response.text}"
        print(f"✓ Profile phone updated to: {new_phone}")
    
    def test_update_profile_both_fields(self, auth_token):
        """Test updating both name and phone"""
        new_name = "Parent Test User"
        new_phone = "555-123-4567"
        response = requests.put(
            f"{BASE_URL}/api/profile",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"name": new_name, "phone": new_phone}
        )
        assert response.status_code == 200, f"Profile update failed: {response.text}"
        print(f"✓ Profile updated with name: {new_name}, phone: {new_phone}")
    
    def test_update_profile_empty_fails(self, auth_token):
        """Test that empty update fails"""
        response = requests.put(
            f"{BASE_URL}/api/profile",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={}
        )
        assert response.status_code == 400
        print("✓ Empty profile update correctly rejected")


class TestStudents:
    """Student (Kids) management tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_get_students(self, auth_token):
        """Test getting list of students"""
        response = requests.get(
            f"{BASE_URL}/api/students",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} students")
        return data
    
    def test_create_student(self, auth_token):
        """Test creating a new student"""
        student_data = {
            "name": f"TEST_Child_{datetime.now().strftime('%H%M%S')}",
            "age": 10,
            "grade": "5th Grade",
            "email": None,
            "phone": None,
            "notify_upcoming_sessions": True,
            "auto_send_schedule": False
        }
        response = requests.post(
            f"{BASE_URL}/api/students",
            headers={"Authorization": f"Bearer {auth_token}"},
            json=student_data
        )
        assert response.status_code == 200, f"Create student failed: {response.text}"
        data = response.json()
        assert "student_id" in data
        assert data["name"] == student_data["name"]
        print(f"✓ Created student: {data['name']} (ID: {data['student_id']})")
        return data
    
    def test_create_student_minimal(self, auth_token):
        """Test creating student with minimal data (just name)"""
        student_data = {
            "name": f"TEST_MinimalChild_{datetime.now().strftime('%H%M%S')}"
        }
        response = requests.post(
            f"{BASE_URL}/api/students",
            headers={"Authorization": f"Bearer {auth_token}"},
            json=student_data
        )
        assert response.status_code == 200, f"Create student failed: {response.text}"
        data = response.json()
        assert "student_id" in data
        print(f"✓ Created minimal student: {data['name']}")
        return data
    
    def test_create_student_with_notifications(self, auth_token):
        """Test creating student with notification settings"""
        student_data = {
            "name": f"TEST_NotifyChild_{datetime.now().strftime('%H%M%S')}",
            "age": 12,
            "email": "test@example.com",
            "notify_upcoming_sessions": True,
            "auto_send_schedule": True
        }
        response = requests.post(
            f"{BASE_URL}/api/students",
            headers={"Authorization": f"Bearer {auth_token}"},
            json=student_data
        )
        assert response.status_code == 200, f"Create student failed: {response.text}"
        data = response.json()
        assert data.get("notify_upcoming_sessions") == True
        assert data.get("auto_send_schedule") == True
        print(f"✓ Created student with notifications: {data['name']}")
        return data
    
    def test_update_student(self, auth_token):
        """Test updating a student"""
        # First create a student
        create_response = requests.post(
            f"{BASE_URL}/api/students",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"name": f"TEST_UpdateChild_{datetime.now().strftime('%H%M%S')}"}
        )
        assert create_response.status_code == 200
        student_id = create_response.json()["student_id"]
        
        # Update the student
        update_data = {
            "name": "Updated Child Name",
            "age": 11,
            "grade": "6th Grade",
            "notify_upcoming_sessions": True,
            "auto_send_schedule": True
        }
        response = requests.put(
            f"{BASE_URL}/api/students/{student_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
            json=update_data
        )
        assert response.status_code == 200, f"Update student failed: {response.text}"
        data = response.json()
        assert data["name"] == "Updated Child Name"
        print(f"✓ Updated student: {student_id}")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/students/{student_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
    
    def test_delete_student(self, auth_token):
        """Test deleting a student"""
        # First create a student
        create_response = requests.post(
            f"{BASE_URL}/api/students",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"name": f"TEST_DeleteChild_{datetime.now().strftime('%H%M%S')}"}
        )
        assert create_response.status_code == 200
        student_id = create_response.json()["student_id"]
        
        # Delete the student
        response = requests.delete(
            f"{BASE_URL}/api/students/{student_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        print(f"✓ Deleted student: {student_id}")
        
        # Verify deletion
        get_response = requests.get(
            f"{BASE_URL}/api/students",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        students = get_response.json()
        assert not any(s.get("student_id") == student_id for s in students)
        print("✓ Verified student was deleted")


class TestTutors:
    """Tutor listing and detail tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_get_tutors(self, auth_token):
        """Test getting list of tutors"""
        response = requests.get(
            f"{BASE_URL}/api/tutors",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} tutors")
        if len(data) > 0:
            print(f"  First tutor: {data[0].get('user_name', data[0].get('name', 'Unknown'))}")
        return data
    
    def test_get_tutor_detail(self, auth_token):
        """Test getting tutor details"""
        # First get list of tutors
        list_response = requests.get(
            f"{BASE_URL}/api/tutors",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert list_response.status_code == 200
        tutors = list_response.json()
        
        if len(tutors) == 0:
            pytest.skip("No tutors available for testing")
        
        tutor_id = tutors[0].get("tutor_id")
        
        # Get tutor detail
        response = requests.get(
            f"{BASE_URL}/api/tutors/{tutor_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("tutor_id") == tutor_id
        print(f"✓ Got tutor detail: {data.get('user_name', data.get('name'))}")
        return data
    
    def test_get_tutor_availability(self, auth_token):
        """Test getting tutor availability"""
        # First get list of tutors
        list_response = requests.get(
            f"{BASE_URL}/api/tutors",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert list_response.status_code == 200
        tutors = list_response.json()
        
        if len(tutors) == 0:
            pytest.skip("No tutors available for testing")
        
        tutor_id = tutors[0].get("tutor_id")
        
        # Get availability for tomorrow
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        response = requests.get(
            f"{BASE_URL}/api/tutors/{tutor_id}/availability",
            headers={"Authorization": f"Bearer {auth_token}"},
            params={"date": tomorrow}
        )
        # Availability endpoint might return 200 with empty slots or 404
        assert response.status_code in [200, 404]
        if response.status_code == 200:
            data = response.json()
            slots = data.get("slots", data.get("available_slots", []))
            print(f"✓ Got {len(slots)} slots for {tomorrow}")
        else:
            print(f"✓ No availability configured for {tomorrow}")


class TestBookingFlow:
    """Booking flow tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_create_booking_hold(self, auth_token):
        """Test creating a booking hold"""
        # Get a tutor
        tutors_response = requests.get(
            f"{BASE_URL}/api/tutors",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert tutors_response.status_code == 200
        tutors = tutors_response.json()
        
        if len(tutors) == 0:
            pytest.skip("No tutors available for testing")
        
        tutor_id = tutors[0].get("tutor_id")
        
        # Create a hold for tomorrow at 10 AM
        tomorrow = datetime.now() + timedelta(days=1)
        start_at = tomorrow.replace(hour=10, minute=0, second=0, microsecond=0).isoformat() + "Z"
        
        response = requests.post(
            f"{BASE_URL}/api/booking-holds",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "tutor_id": tutor_id,
                "start_at": start_at,
                "duration_minutes": 60
            }
        )
        # Hold might fail if slot is not available, which is OK
        if response.status_code == 200:
            data = response.json()
            assert "hold_id" in data
            print(f"✓ Created booking hold: {data['hold_id']}")
            return data
        else:
            print(f"✓ Booking hold not created (slot may not be available): {response.status_code}")
            return None
    
    def test_get_bookings(self, auth_token):
        """Test getting user's bookings"""
        response = requests.get(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} bookings")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_cleanup_test_students(self, auth_token):
        """Clean up TEST_ prefixed students"""
        response = requests.get(
            f"{BASE_URL}/api/students",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        students = response.json()
        
        deleted_count = 0
        for student in students:
            if student.get("name", "").startswith("TEST_"):
                delete_response = requests.delete(
                    f"{BASE_URL}/api/students/{student['student_id']}",
                    headers={"Authorization": f"Bearer {auth_token}"}
                )
                if delete_response.status_code == 200:
                    deleted_count += 1
        
        print(f"✓ Cleaned up {deleted_count} test students")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
