"""
Third-Party Integration Services
Cloudinary, Mixpanel, Sentry, New Relic
"""
import os
import logging
import base64
import httpx
from typing import Optional, Dict, Any
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# ============== CLOUDINARY SERVICE ==============
class CloudinaryService:
    """
    Cloudinary image upload/delete/update service
    """
    def __init__(self):
        self.cloud_name = os.environ.get('CLOUDINARY_CLOUD_NAME', '')
        self.api_key = os.environ.get('CLOUDINARY_API_KEY', '')
        self.api_secret = os.environ.get('CLOUDINARY_API_SECRET', '')
        self.base_url = f"https://api.cloudinary.com/v1_1/{self.cloud_name}"
        self.enabled = bool(self.cloud_name and self.api_key and self.api_secret)
        
        if not self.enabled:
            logger.warning("Cloudinary not configured - image uploads will use base64 fallback")
    
    def _generate_signature(self, params: dict) -> str:
        """Generate signature for Cloudinary API"""
        import hashlib
        sorted_params = '&'.join([f"{k}={v}" for k, v in sorted(params.items())])
        to_sign = f"{sorted_params}{self.api_secret}"
        return hashlib.sha1(to_sign.encode()).hexdigest()
    
    async def upload_image(
        self, 
        image_data: str,  # Base64 encoded or URL
        folder: str = "maestrohub",
        public_id: Optional[str] = None,
        transformation: Optional[dict] = None
    ) -> Dict[str, Any]:
        """
        Upload image to Cloudinary
        Returns: {"url": str, "public_id": str, "secure_url": str}
        """
        if not self.enabled:
            # Fallback: return base64 data as-is
            return {
                "url": image_data if image_data.startswith('http') else f"data:image/jpeg;base64,{image_data}",
                "public_id": public_id or f"local_{datetime.now().timestamp()}",
                "secure_url": image_data,
                "provider": "local"
            }
        
        try:
            timestamp = int(datetime.now(timezone.utc).timestamp())
            params = {
                "timestamp": timestamp,
                "folder": folder,
            }
            if public_id:
                params["public_id"] = public_id
            
            params["signature"] = self._generate_signature(params)
            params["api_key"] = self.api_key
            
            # Prepare upload data
            if image_data.startswith('http'):
                params["file"] = image_data
            else:
                params["file"] = f"data:image/jpeg;base64,{image_data}"
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/image/upload",
                    data=params,
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "url": data.get("url"),
                        "public_id": data.get("public_id"),
                        "secure_url": data.get("secure_url"),
                        "width": data.get("width"),
                        "height": data.get("height"),
                        "format": data.get("format"),
                        "provider": "cloudinary"
                    }
                else:
                    logger.error(f"Cloudinary upload failed: {response.text}")
                    return {"error": "Upload failed", "details": response.text}
                    
        except Exception as e:
            logger.error(f"Cloudinary upload error: {e}")
            return {"error": str(e)}
    
    async def delete_image(self, public_id: str) -> bool:
        """Delete image from Cloudinary"""
        if not self.enabled:
            return True  # No-op for local storage
        
        try:
            timestamp = int(datetime.now(timezone.utc).timestamp())
            params = {
                "public_id": public_id,
                "timestamp": timestamp,
            }
            params["signature"] = self._generate_signature(params)
            params["api_key"] = self.api_key
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/image/destroy",
                    data=params,
                    timeout=30.0
                )
                return response.status_code == 200
        except Exception as e:
            logger.error(f"Cloudinary delete error: {e}")
            return False
    
    async def update_image(
        self, 
        old_public_id: str,
        new_image_data: str,
        folder: str = "maestrohub"
    ) -> Dict[str, Any]:
        """Update image by deleting old and uploading new"""
        # Delete old image
        if old_public_id:
            await self.delete_image(old_public_id)
        
        # Upload new image
        return await self.upload_image(new_image_data, folder)

# ============== MIXPANEL ANALYTICS SERVICE ==============
class MixpanelService:
    """
    Mixpanel analytics tracking service
    """
    def __init__(self):
        self.token = os.environ.get('MIXPANEL_TOKEN', '')
        self.api_url = "https://api.mixpanel.com/track"
        self.enabled = bool(self.token)
        
        if not self.enabled:
            logger.warning("Mixpanel not configured - analytics will be logged locally")
    
    async def track(
        self, 
        event_name: str, 
        distinct_id: str,
        properties: Optional[Dict[str, Any]] = None
    ):
        """Track an event in Mixpanel"""
        if not self.enabled:
            logger.info(f"[Analytics] {event_name} - user: {distinct_id}, props: {properties}")
            return
        
        try:
            data = {
                "event": event_name,
                "properties": {
                    "token": self.token,
                    "distinct_id": distinct_id,
                    "time": int(datetime.now(timezone.utc).timestamp()),
                    **(properties or {})
                }
            }
            
            import json
            encoded_data = base64.b64encode(json.dumps([data]).encode()).decode()
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.api_url,
                    params={"data": encoded_data},
                    timeout=5.0
                )
                if response.status_code != 200:
                    logger.warning(f"Mixpanel track failed: {response.text}")
                    
        except Exception as e:
            logger.error(f"Mixpanel error: {e}")
    
    async def set_user_profile(self, distinct_id: str, properties: Dict[str, Any]):
        """Set user profile properties"""
        if not self.enabled:
            logger.info(f"[Analytics] Profile update - user: {distinct_id}, props: {properties}")
            return
        
        try:
            data = {
                "$token": self.token,
                "$distinct_id": distinct_id,
                "$set": properties
            }
            
            import json
            encoded_data = base64.b64encode(json.dumps([data]).encode()).decode()
            
            async with httpx.AsyncClient() as client:
                await client.post(
                    "https://api.mixpanel.com/engage",
                    params={"data": encoded_data},
                    timeout=5.0
                )
        except Exception as e:
            logger.error(f"Mixpanel profile error: {e}")

# ============== SENTRY ERROR TRACKING SERVICE ==============
class SentryService:
    """
    Sentry error tracking service
    """
    def __init__(self):
        self.dsn = os.environ.get('SENTRY_DSN', '')
        self.enabled = bool(self.dsn)
        self._initialized = False
        
        if self.enabled:
            self._initialize()
        else:
            logger.warning("Sentry not configured - errors will be logged locally")
    
    def _initialize(self):
        """Initialize Sentry SDK"""
        try:
            import sentry_sdk
            from sentry_sdk.integrations.fastapi import FastApiIntegration
            from sentry_sdk.integrations.starlette import StarletteIntegration
            
            sentry_sdk.init(
                dsn=self.dsn,
                integrations=[
                    StarletteIntegration(),
                    FastApiIntegration(),
                ],
                traces_sample_rate=0.1,  # 10% of transactions for performance monitoring
                profiles_sample_rate=0.1,
                environment=os.environ.get('ENVIRONMENT', 'development'),
                release=os.environ.get('APP_VERSION', '1.0.0'),
            )
            self._initialized = True
            logger.info("Sentry initialized successfully")
        except ImportError:
            logger.warning("sentry-sdk not installed")
        except Exception as e:
            logger.error(f"Sentry initialization failed: {e}")
    
    def capture_exception(self, exception: Exception, extra: Optional[Dict] = None):
        """Capture and report an exception"""
        if self._initialized:
            import sentry_sdk
            with sentry_sdk.push_scope() as scope:
                if extra:
                    for key, value in extra.items():
                        scope.set_extra(key, value)
                sentry_sdk.capture_exception(exception)
        else:
            logger.error(f"Exception: {exception}", extra=extra)
    
    def capture_message(self, message: str, level: str = "info", extra: Optional[Dict] = None):
        """Capture and report a message"""
        if self._initialized:
            import sentry_sdk
            with sentry_sdk.push_scope() as scope:
                if extra:
                    for key, value in extra.items():
                        scope.set_extra(key, value)
                sentry_sdk.capture_message(message, level=level)
        else:
            logger.log(logging.getLevelName(level.upper()), message, extra=extra)
    
    def set_user(self, user_id: str, email: str = None, role: str = None):
        """Set user context for error reports"""
        if self._initialized:
            import sentry_sdk
            sentry_sdk.set_user({
                "id": user_id,
                "email": email,
                "role": role
            })

# ============== NEW RELIC APM SERVICE ==============
class NewRelicService:
    """
    New Relic APM service for performance monitoring
    """
    def __init__(self):
        self.license_key = os.environ.get('NEW_RELIC_LICENSE_KEY', '')
        self.app_name = os.environ.get('NEW_RELIC_APP_NAME', 'MaestroHub')
        self.enabled = bool(self.license_key)
        self._initialized = False
        
        if self.enabled:
            self._initialize()
        else:
            logger.warning("New Relic not configured - APM will be disabled")
    
    def _initialize(self):
        """Initialize New Relic agent"""
        try:
            import newrelic.agent
            newrelic.agent.initialize()
            self._initialized = True
            logger.info("New Relic agent initialized")
        except ImportError:
            logger.warning("newrelic package not installed")
        except Exception as e:
            logger.error(f"New Relic initialization failed: {e}")
    
    def record_custom_event(self, event_type: str, params: Dict[str, Any]):
        """Record a custom event"""
        if self._initialized:
            try:
                import newrelic.agent
                newrelic.agent.record_custom_event(event_type, params)
            except Exception as e:
                logger.error(f"New Relic event error: {e}")
        else:
            logger.info(f"[APM Event] {event_type}: {params}")
    
    def record_custom_metric(self, name: str, value: float):
        """Record a custom metric"""
        if self._initialized:
            try:
                import newrelic.agent
                newrelic.agent.record_custom_metric(name, value)
            except Exception as e:
                logger.error(f"New Relic metric error: {e}")
        else:
            logger.info(f"[APM Metric] {name}: {value}")
    
    def notice_error(self, error: Exception, params: Optional[Dict] = None):
        """Report an error to New Relic"""
        if self._initialized:
            try:
                import newrelic.agent
                newrelic.agent.notice_error(error=error, attributes=params)
            except Exception as e:
                logger.error(f"New Relic error reporting failed: {e}")
        else:
            logger.error(f"[APM Error] {error}", extra=params)

# ============== SERVICE INSTANCES ==============
cloudinary_service = CloudinaryService()
mixpanel_service = MixpanelService()
sentry_service = SentryService()
newrelic_service = NewRelicService()

# ============== HELPER FUNCTIONS ==============
async def track_event(event_name: str, user_id: str, properties: dict = None):
    """Track an analytics event across all configured services"""
    await mixpanel_service.track(event_name, user_id, properties)
    newrelic_service.record_custom_event(event_name, {"user_id": user_id, **(properties or {})})

def capture_error(error: Exception, extra: dict = None):
    """Capture an error across all configured services"""
    sentry_service.capture_exception(error, extra)
    newrelic_service.notice_error(error, extra)
