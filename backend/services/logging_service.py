"""
Enhanced Logging Configuration for Maestro Habitat
- Console output for development
- File logging with rotation for production
- Separate error log for critical issues
"""
import os
import logging
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler
from datetime import datetime

# Create logs directory
LOGS_DIR = "/app/backend/logs"
os.makedirs(LOGS_DIR, exist_ok=True)

# Log format
DETAILED_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s:%(lineno)d | %(message)s"
SIMPLE_FORMAT = "%(asctime)s | %(levelname)-8s | %(message)s"

def setup_logging(
    log_level: str = "INFO",
    enable_file_logging: bool = True,
    max_file_size_mb: int = 10,
    backup_count: int = 5
):
    """
    Configure application logging
    
    Args:
        log_level: Minimum log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        enable_file_logging: Whether to write logs to files
        max_file_size_mb: Max size of each log file before rotation
        backup_count: Number of backup files to keep
    """
    # Get root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
    
    # Clear existing handlers
    root_logger.handlers = []
    
    # Console handler (always enabled)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(logging.Formatter(SIMPLE_FORMAT))
    root_logger.addHandler(console_handler)
    
    if enable_file_logging:
        # Main application log (rotating by size)
        app_log_path = os.path.join(LOGS_DIR, "app.log")
        app_handler = RotatingFileHandler(
            app_log_path,
            maxBytes=max_file_size_mb * 1024 * 1024,
            backupCount=backup_count,
            encoding='utf-8'
        )
        app_handler.setLevel(logging.DEBUG)
        app_handler.setFormatter(logging.Formatter(DETAILED_FORMAT))
        root_logger.addHandler(app_handler)
        
        # Error log (only ERROR and CRITICAL)
        error_log_path = os.path.join(LOGS_DIR, "error.log")
        error_handler = RotatingFileHandler(
            error_log_path,
            maxBytes=max_file_size_mb * 1024 * 1024,
            backupCount=backup_count,
            encoding='utf-8'
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(logging.Formatter(DETAILED_FORMAT))
        root_logger.addHandler(error_handler)
        
        # Daily access log (rotating by time)
        access_log_path = os.path.join(LOGS_DIR, "access.log")
        access_handler = TimedRotatingFileHandler(
            access_log_path,
            when='midnight',
            interval=1,
            backupCount=7,  # Keep 7 days
            encoding='utf-8'
        )
        access_handler.setLevel(logging.INFO)
        access_handler.setFormatter(logging.Formatter("%(asctime)s | %(message)s"))
        
        # Create a separate logger for access logs
        access_logger = logging.getLogger('access')
        access_logger.addHandler(access_handler)
        access_logger.setLevel(logging.INFO)
        access_logger.propagate = False
    
    # Suppress noisy third-party loggers
    logging.getLogger('httpx').setLevel(logging.WARNING)
    logging.getLogger('httpcore').setLevel(logging.WARNING)
    logging.getLogger('urllib3').setLevel(logging.WARNING)
    logging.getLogger('pymongo').setLevel(logging.WARNING)
    
    root_logger.info(f"Logging initialized - Level: {log_level}, File logging: {enable_file_logging}")
    
    return root_logger


def get_logger(name: str) -> logging.Logger:
    """Get a logger for a specific module"""
    return logging.getLogger(name)


def log_request(method: str, path: str, status_code: int, duration_ms: float, user_id: str = None):
    """Log API request to access log"""
    access_logger = logging.getLogger('access')
    user_str = f"user={user_id}" if user_id else "user=anonymous"
    access_logger.info(f"{method} {path} | {status_code} | {duration_ms:.2f}ms | {user_str}")


def log_error(error: Exception, context: dict = None):
    """Log error with context"""
    logger = logging.getLogger('error')
    error_info = {
        "type": type(error).__name__,
        "message": str(error),
        "timestamp": datetime.utcnow().isoformat(),
        "context": context or {}
    }
    logger.error(f"Exception: {error_info}")


def log_event(event_name: str, data: dict = None):
    """Log application event"""
    logger = logging.getLogger('events')
    logger.info(f"EVENT: {event_name} | {data or {}}")
