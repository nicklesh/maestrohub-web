"""
Authentication Service for Maestro Habitat
Handles user registration, login, JWT tokens, and session management
"""
import bcrypt
import jwt
import uuid
import re
import html
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr
from jwt.exceptions import InvalidTokenError, ExpiredSignatureError, DecodeError

logger = logging.getLogger(__name__)

# JWT Config
JWT_SECRET = None  # Will be set from environment
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_DAYS = 7


class AuthService:
    def __init__(self, db, jwt_secret: str):
        self.db = db
        global JWT_SECRET
        JWT_SECRET = jwt_secret
    
    # ============== PASSWORD HELPERS ==============
    @staticmethod
    def hash_password(password: str) -> str:
        return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    
    @staticmethod
    def verify_password(password: str, hashed: str) -> bool:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    
    @staticmethod
    def validate_password_strength(password: str) -> tuple:
        """Validate password meets security requirements"""
        if not password:
            return False, "Password is required"
        if len(password) < 8:
            return False, "Password must be at least 8 characters long"
        if not re.search(r"[A-Z]", password):
            return False, "Password must contain at least one uppercase letter"
        if not re.search(r"[a-z]", password):
            return False, "Password must contain at least one lowercase letter"
        if not re.search(r"\d", password):
            return False, "Password must contain at least one number"
        return True, "Password is valid"
    
    # ============== JWT HELPERS ==============
    @staticmethod
    def create_jwt_token(user_id: str) -> str:
        payload = {
            "user_id": user_id,
            "iat": datetime.now(timezone.utc),
            "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)
        }
        return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    @staticmethod
    def decode_jwt_token(token: str) -> Optional[str]:
        """Securely decode and validate JWT token. Returns user_id if valid."""
        if not token:
            return None
        
        parts = token.split('.')
        if len(parts) != 3:
            logger.warning(f"Invalid JWT format: expected 3 parts, got {len(parts)}")
            return None
        
        try:
            payload = jwt.decode(
                token, 
                JWT_SECRET, 
                algorithms=[JWT_ALGORITHM],
                options={
                    "verify_signature": True,
                    "verify_exp": True,
                    "require": ["user_id", "exp"]
                }
            )
            user_id = payload.get("user_id")
            if not user_id:
                logger.warning("JWT missing user_id claim")
                return None
            return user_id
        except ExpiredSignatureError:
            logger.info("JWT token expired")
            return None
        except InvalidTokenError as e:
            logger.warning(f"Invalid JWT token: {str(e)}")
            return None
        except DecodeError as e:
            logger.warning(f"JWT decode error: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Unexpected JWT error: {str(e)}")
            return None
    
    # ============== SANITIZATION ==============
    @staticmethod
    def sanitize_html(text: str) -> str:
        """Sanitize HTML content to prevent XSS"""
        if not text:
            return text
        return html.escape(text)
    
    @staticmethod
    def sanitize_for_mongo(value: Any) -> Any:
        """Sanitize input to prevent NoSQL injection"""
        if isinstance(value, str):
            dangerous_patterns = ['$where', '$regex', '$gt', '$lt', '$ne', '$or', '$and', '$not', '$exists']
            for pattern in dangerous_patterns:
                if pattern in value.lower():
                    return value.replace(pattern, '')
            return value
        elif isinstance(value, dict):
            return {k: AuthService.sanitize_for_mongo(v) for k, v in value.items() if not k.startswith('$')}
        elif isinstance(value, list):
            return [AuthService.sanitize_for_mongo(item) for item in value]
        return value
    
    # ============== USER OPERATIONS ==============
    async def register_user(self, email: str, name: str, password: str, role: str = "consumer", 
                           picture: str = None, device: dict = None) -> Dict:
        """Register a new user"""
        # Check if email exists
        existing = await self.db.users.find_one({"email": email}, {"_id": 0})
        if existing:
            return {"success": False, "error": "Email already registered"}
        
        # Validate password
        is_valid, error_msg = self.validate_password_strength(password)
        if not is_valid:
            return {"success": False, "error": error_msg}
        
        # Sanitize inputs
        sanitized_name = self.sanitize_html(name) if name else name
        
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": sanitized_name,
            "picture": picture,
            "role": role,
            "password_hash": self.hash_password(password),
            "devices": [device] if device else [],
            "created_at": datetime.now(timezone.utc)
        }
        await self.db.users.insert_one(user_doc)
        
        token = self.create_jwt_token(user_id)
        return {"success": True, "user_id": user_id, "token": token, "role": role}
    
    async def login_user(self, email: str, password: str, device: dict = None) -> Dict:
        """Authenticate user and return token"""
        user_doc = await self.db.users.find_one({"email": email}, {"_id": 0})
        if not user_doc:
            logger.error(f"Login failed: user not found for {email}")
            return {"success": False, "error": "Invalid credentials"}
        
        if not user_doc.get("password_hash"):
            logger.error(f"Login failed: no password_hash for {email}")
            return {"success": False, "error": "Invalid credentials"}
        
        if not self.verify_password(password, user_doc["password_hash"]):
            logger.error(f"Login failed: password mismatch for {email}")
            return {"success": False, "error": "Invalid credentials"}
        
        # Update device if provided
        if device:
            devices = user_doc.get("devices", [])
            device_exists = any(d.get("device_id") == device.get("device_id") for d in devices)
            if not device_exists:
                devices.append(device)
                await self.db.users.update_one({"user_id": user_doc["user_id"]}, {"$set": {"devices": devices}})
        
        token = self.create_jwt_token(user_doc["user_id"])
        return {
            "success": True, 
            "user_id": user_doc["user_id"], 
            "token": token, 
            "role": user_doc.get("role", "consumer")
        }
    
    async def get_current_user(self, session_token: str) -> Optional[Dict]:
        """Get current user from session token"""
        if not session_token or not session_token.strip():
            return None
        
        # Try JWT token
        user_id = self.decode_jwt_token(session_token)
        if user_id:
            user_doc = await self.db.users.find_one({"user_id": user_id}, {"_id": 0})
            if user_doc:
                return user_doc
        
        # Try session in database (for Google OAuth)
        session = await self.db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if session:
            expires_at = session["expires_at"]
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at > datetime.now(timezone.utc):
                user_doc = await self.db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
                if user_doc:
                    return user_doc
        
        return None
    
    async def logout_user(self, session_token: str) -> bool:
        """Logout user by removing session"""
        if session_token:
            await self.db.user_sessions.delete_one({"session_token": session_token})
        return True
    
    async def change_password(self, user_id: str, current_password: str, new_password: str) -> Dict:
        """Change user password"""
        user_doc = await self.db.users.find_one({"user_id": user_id})
        if not user_doc:
            return {"success": False, "error": "User not found"}
        
        if not user_doc.get("password_hash"):
            return {"success": False, "error": "Account uses social login, cannot change password"}
        
        if not self.verify_password(current_password, user_doc["password_hash"]):
            return {"success": False, "error": "Current password is incorrect"}
        
        is_valid, error_msg = self.validate_password_strength(new_password)
        if not is_valid:
            return {"success": False, "error": error_msg}
        
        new_hash = self.hash_password(new_password)
        await self.db.users.update_one({"user_id": user_id}, {"$set": {"password_hash": new_hash}})
        
        return {"success": True, "message": "Password changed successfully"}
    
    async def update_profile(self, user_id: str, name: str = None, phone: str = None) -> Dict:
        """Update user profile"""
        update_data = {}
        if name:
            update_data["name"] = self.sanitize_html(name)
        if phone:
            update_data["phone"] = self.sanitize_html(phone)
        
        if not update_data:
            return {"success": False, "error": "No fields to update"}
        
        await self.db.users.update_one({"user_id": user_id}, {"$set": update_data})
        updated = await self.db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
        return {"success": True, "user": updated}
