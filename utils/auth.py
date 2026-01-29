"""
Authentication utilities for password hashing and verification
"""
from passlib.context import CryptContext

# Configure password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """
    Hash a plain text password using bcrypt
    
    Args:
        password: Plain text password
        
    Returns:
        Hashed password string
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain text password against a hashed password
    
    Args:
        plain_password: Plain text password to verify
        hashed_password: Hashed password from database
        
    Returns:
        True if password matches, False otherwise
    """
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        # bcrypt limitation: password must be <= 72 bytes
        # If password is too long, verification fails safely instead of crashing
        return False


def is_password_hashed(password: str) -> bool:
    """
    Check if a password is already hashed (bcrypt format)
    
    Args:
        password: Password string to check
        
    Returns:
        True if password is hashed, False if plain text
    """
    return password.startswith("$2b$") or password.startswith("$2a$")
