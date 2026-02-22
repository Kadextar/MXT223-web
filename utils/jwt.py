"""
JWT token utilities for authentication
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import os

# JWT Configuration (overridable via env)
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("JWT_REFRESH_EXPIRE_DAYS", "7"))


def create_access_token(data: dict) -> str:
    """
    Create a JWT access token
    
    Args:
        data: Dictionary with user data (should include 'sub' for user ID)
        
    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({
        "exp": expire,
        "type": "access",
        "iat": datetime.utcnow()
    })
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict, days: Optional[int] = None) -> str:
    """
    Create a JWT refresh token. Use days to override (e.g. remember_me=30).
    """
    to_encode = data.copy()
    expire_days = days if days is not None else REFRESH_TOKEN_EXPIRE_DAYS
    expire = datetime.utcnow() + timedelta(days=expire_days)
    to_encode.update({
        "exp": expire,
        "type": "refresh",
        "iat": datetime.utcnow()
    })
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str, token_type: str = "access") -> Optional[dict]:
    """
    Verify and decode a JWT token
    
    Args:
        token: JWT token string
        token_type: Expected token type ('access' or 'refresh')
        
    Returns:
        Decoded payload if valid, None otherwise
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Check token type
        if payload.get("type") != token_type:
            return None
            
        return payload
    except JWTError:
        return None


def is_jwt_token(token: str) -> bool:
    """
    Check if a string is a JWT token (has 3 parts separated by dots)
    
    Args:
        token: String to check
        
    Returns:
        True if looks like JWT, False otherwise
    """
    return token.count('.') == 2
