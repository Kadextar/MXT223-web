"""Centralized logging for the application. Optional JSON output (LOG_JSON=1)."""
import json
import logging
import sys
from datetime import timezone
from typing import Any

def setup_logging(level: str = "INFO", json_log: bool = False) -> logging.Logger:
    """Configure root logger for the app. Returns app logger."""
    log = logging.getLogger("app")
    if log.handlers:
        return log
    log.setLevel(getattr(logging, level.upper(), logging.INFO))
    h = logging.StreamHandler(sys.stderr)
    if json_log:
        h.setFormatter(JsonFormatter())
    else:
        h.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))
    log.addHandler(h)
    return log


class JsonFormatter(logging.Formatter):
    """Format log records as one JSON object per line."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": record.created,
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        if getattr(record, "request_id", None):
            payload["request_id"] = record.request_id
        return json.dumps(payload, ensure_ascii=False, default=str)


logger = logging.getLogger("app")
