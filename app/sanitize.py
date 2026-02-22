"""Sanitize user-generated text (reviews, announcements)."""
import re
from typing import Optional


def sanitize_text(text: Optional[str], max_length: int = 500) -> str:
    """Strip HTML/tags and truncate to max_length. Returns non-None str."""
    if text is None:
        return ""
    s = str(text).strip()
    # Remove HTML-like tags
    s = re.sub(r"<[^>]+>", "", s)
    # Normalize whitespace
    s = re.sub(r"\s+", " ", s)
    return s[:max_length] if len(s) > max_length else s
