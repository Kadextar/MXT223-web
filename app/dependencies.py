from fastapi import Header, HTTPException
from app.database import database
from app.logging_config import logger

async def get_current_user(authorization: str = Header(None)):
    """Get current user info from token"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        from utils.jwt import verify_token, is_jwt_token
        
        # Extract token from Bearer header
        token = authorization.replace("Bearer ", "")
        
        # Try to verify as JWT first
        if is_jwt_token(token):
            payload = verify_token(token, "access")
            if payload:
                telegram_id = payload.get("sub")
            else:
                raise HTTPException(status_code=401, detail="Invalid or expired token")
        else:
            # Fallback: old format (plain telegram_id for backward compatibility)
            telegram_id = token
        
        # Get user from database
        query = "SELECT telegram_id, name FROM students WHERE telegram_id = :telegram_id"
        student = await database.fetch_one(query=query, values={"telegram_id": telegram_id})
        
        if not student:
            raise HTTPException(status_code=401, detail="User not found")
        
        return {
            "telegram_id": student["telegram_id"],
            "name": student["name"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Get user error")
        raise HTTPException(status_code=500, detail="Server error")

async def require_admin(authorization: str = Header(None)):
    """Dependency to check if user is admin"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        from utils.jwt import verify_token, is_jwt_token
        
        token = authorization.replace("Bearer ", "")
        
        if is_jwt_token(token):
            payload = verify_token(token, "access")
            if not payload:
                raise HTTPException(status_code=401, detail="Invalid token")
            telegram_id = payload.get("sub")
        else:
            telegram_id = token
            
        student = await database.fetch_one(
            "SELECT * FROM students WHERE telegram_id = :tid", 
            {"tid": telegram_id}
        )
        
        if not student:
            raise HTTPException(status_code=401, detail="User not found")
            
        if not student["is_admin"]:
            raise HTTPException(status_code=403, detail="Admin privileges required")
            
        return student
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Admin check error")
        raise HTTPException(status_code=500, detail="Server error")
