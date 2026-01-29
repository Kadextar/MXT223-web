"""
Caching utilities for API endpoints
"""
from cachetools import TTLCache
from functools import wraps
import hashlib
import json
from typing import Callable

# Global cache instances
# maxsize=100 - up to 100 different cached responses
# ttl=300 - 5 minutes default TTL
schedule_cache = TTLCache(maxsize=100, ttl=300)


def cache_key(*args, **kwargs) -> str:
    """
    Generate a cache key from function arguments
    
    Args:
        *args: Positional arguments
        **kwargs: Keyword arguments
        
    Returns:
        MD5 hash of serialized arguments
    """
    key_data = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True, default=str)
    return hashlib.md5(key_data.encode()).hexdigest()


def cached(ttl: int = 300):
    """
    Decorator for caching async function results
    
    Args:
        ttl: Time to live in seconds (default: 5 minutes)
        
    Usage:
        @cached(ttl=300)
        async def get_data():
            return await database.fetch_all(...)
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            key = f"{func.__name__}:{cache_key(*args, **kwargs)}"
            
            # Check cache
            if key in schedule_cache:
                print(f"✓ Cache HIT: {key[:50]}...")
                return schedule_cache[key]
            
            # Cache miss - call function
            print(f"✗ Cache MISS: {key[:50]}...")
            result = await func(*args, **kwargs)
            
            # Store in cache
            schedule_cache[key] = result
            return result
        
        # Add cache management methods
        wrapper.clear_cache = lambda: schedule_cache.clear()
        wrapper.cache_info = lambda: {
            "size": len(schedule_cache),
            "maxsize": schedule_cache.maxsize,
            "ttl": schedule_cache.ttl
        }
        
        return wrapper
    return decorator


def clear_cache():
    """Clear all cached data"""
    schedule_cache.clear()
    print("🗑️ Cache cleared")


def get_cache_stats() -> dict:
    """
    Get cache statistics
    
    Returns:
        Dictionary with cache stats
    """
    return {
        "size": len(schedule_cache),
        "maxsize": schedule_cache.maxsize,
        "ttl": schedule_cache.ttl,
        "currsize": schedule_cache.currsize
    }
