"""API 密钥校验与速率限制（优先 Redis，回退内存）"""
import os
import time
from functools import wraps
from typing import Optional

from flask import jsonify, request

API_KEY = os.environ.get("API_KEY", "").strip()
RATE_LIMIT_DEFAULT = int(os.environ.get("RATE_LIMIT_PER_MIN", "80"))
RATE_LIMIT_HERO = int(os.environ.get("RATE_LIMIT_HERO_PER_MIN", "24"))

_redis_client: Optional[object] = None
_buckets: dict = {}
_last_prune = 0.0


def init_rate_limiter(redis_client) -> None:
    """由 app 启动时注入 Redis 连接"""
    global _redis_client
    _redis_client = redis_client


def client_ip() -> str:
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "127.0.0.1"


def _prune_memory_buckets(now: float) -> None:
    global _last_prune
    if now - _last_prune < 120:
        return
    _last_prune = now
    window = 60.0
    stale = []
    for key, hits in _buckets.items():
        fresh = [t for t in hits if now - t < window]
        if fresh:
            _buckets[key] = fresh
        else:
            stale.append(key)
    for key in stale:
        del _buckets[key]


def _rate_ok_memory(category: str, limit: int, ip: str) -> bool:
    key = (ip, category)
    now = time.time()
    _prune_memory_buckets(now)
    window = 60.0
    hits = [t for t in _buckets.get(key, []) if now - t < window]
    if len(hits) >= limit:
        return False
    hits.append(now)
    _buckets[key] = hits
    return True


def _rate_ok_redis(category: str, limit: int, ip: str) -> bool:
    if _redis_client is None:
        return _rate_ok_memory(category, limit, ip)
    try:
        key = f"rl:{ip}:{category}"
        count = _redis_client.incr(key)
        if count == 1:
            _redis_client.expire(key, 60)
        return int(count) <= limit
    except Exception:
        return _rate_ok_memory(category, limit, ip)


def rate_limit(category: str = "default", limit=None):
    if limit is None:
        lim = RATE_LIMIT_HERO if category == "hero" else RATE_LIMIT_DEFAULT
    else:
        lim = limit

    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            ip = client_ip()
            if not _rate_ok_redis(category, lim, ip):
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


def is_safe_avatar_url(url: str) -> bool:
    if not url:
        return True
    u = url.strip().lower()
    return u.startswith("https://") or u.startswith("http://")
