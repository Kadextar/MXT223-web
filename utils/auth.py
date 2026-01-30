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
    # Truncate to 72 bytes to avoid bcrypt limitation
    return pwd_context.hash(password[:72])


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
        # Truncate to 72 chars to avoid bcrypt limitation before verifying
        # Standard bcrypt behavior is to reject > 72 bytes, so we handle safely
        return pwd_context.verify(plain_password[:72], hashed_password)
    except Exception:
        # If verification still fails internally for some reason
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
