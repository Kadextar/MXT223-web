"""Simple in-memory counters for Prometheus /metrics endpoint."""
from threading import Lock

_lock = Lock()
_request_total = 0
_request_errors_total = 0


def inc_request_total():
    with _lock:
        global _request_total
        _request_total += 1


def inc_request_errors_total():
    with _lock:
        global _request_errors_total
        _request_errors_total += 1


def get_prometheus_export() -> str:
    with _lock:
        return (
            "# HELP http_requests_total Total HTTP requests.\n"
            "# TYPE http_requests_total counter\n"
            f"http_requests_total {_request_total}\n"
            "# HELP http_request_errors_total Total HTTP 5xx errors.\n"
            "# TYPE http_request_errors_total counter\n"
            f"http_request_errors_total {_request_errors_total}\n"
        )
