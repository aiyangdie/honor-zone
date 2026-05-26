"""API 密钥校验与简易速率限制"""
import os
import time
from functools import wraps

from flask import jsonify, request

API_KEY = os.environ.get("API_KEY", "").strip()
RATE_LIMIT_DEFAULT = int(os.environ.get("RATE_LIMIT_PER_MIN", "80"))
RATE_LIMIT_HERO = int(os.environ.get("RATE_LIMIT_HERO_PER_MIN", "24"))

_buckets: dict = {}


def client_ip() -> str:
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "127.0.0.1"


def _rate_ok(category: str, limit: int) -> bool:
    key = (client_ip(), category)
    now = time.time()
    window = 60.0
    hits = [t for t in _buckets.get(key, []) if now - t < window]
    if len(hits) >= limit:
        return False
    hits.append(now)
    _buckets[key] = hits
    return True


def rate_limit(category: str = "default", limit=None):
    if limit is None:
        lim = RATE_LIMIT_HERO if category == "hero" else RATE_LIMIT_DEFAULT
    else:
        lim = limit

    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            if not _rate_ok(category, lim):
                return jsonify(
                    {"status": "error", "message": "请求过于频繁，请稍后再试"}
                ), 429
            return f(*args, **kwargs)

        return wrapped

    return decorator


def require_write_auth(f):
    """设置 API_KEY 后，写接口需在 Header 携带 X-API-Key"""

    @wraps(f)
    def wrapped(*args, **kwargs):
        if API_KEY:
            auth_hdr = request.headers.get("Authorization", "")
            bearer = auth_hdr[7:].strip() if auth_hdr.startswith("Bearer ") else ""
            token = (
                request.headers.get("X-API-Key")
                or bearer
                or (request.json or {}).get("api_key")
            )
            if token != API_KEY:
                return jsonify(
                    {"status": "error", "message": "需要有效的 API 密钥"}
                ), 401
        return f(*args, **kwargs)

    return wrapped


def safe_message(exc: Exception, fallback: str = "服务异常，请稍后重试") -> str:
    if os.environ.get("FLASK_DEBUG", "").lower() in ("1", "true", "yes"):
        return str(exc)
    return fallback
