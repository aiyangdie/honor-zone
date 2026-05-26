"""服务健康检查与局域网地址"""
import os
import socket
from typing import Any, Dict

from sqlalchemy import text


def get_lan_ip() -> str:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(0.5)
        sock.connect(("8.8.8.8", 80))
        ip = sock.getsockname()[0]
        sock.close()
        return ip
    except OSError:
        return "127.0.0.1"


def check_mysql(engine) -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def check_redis(redis_client) -> bool:
    try:
        return bool(redis_client.ping())
    except Exception:
        return False


def build_service_status(engine, redis_client, hero_online: bool = False) -> Dict[str, Any]:
    port = int(os.environ.get("FLASK_PORT", 5000))
    lan_ip = get_lan_ip()
    mysql_ok = check_mysql(engine)
    redis_ok = check_redis(redis_client)
    return {
        "mysql": mysql_ok,
        "redis": redis_ok,
        "hero_api": hero_online,
        "ready": mysql_ok and redis_ok,
        "port": port,
        "lan_ip": lan_ip,
        "lan_url": f"http://{lan_ip}:{port}",
        "local_url": f"http://127.0.0.1:{port}",
    }


def ensure_favicon(static_dir: str) -> None:
    """static 目录缺少 favicon.ico 时从官方 logo 生成"""
    ico_path = os.path.join(static_dir, "favicon.ico")
    if os.path.isfile(ico_path):
        return
    try:
        import io
        import urllib.request

        from PIL import Image

        url = "https://game.gtimg.cn/images/yxzj/web201706/images/comm/logo.png"
        data = urllib.request.urlopen(url, timeout=15).read()
        img = Image.open(io.BytesIO(data)).convert("RGBA")
        img.resize((32, 32), Image.Resampling.LANCZOS).save(ico_path, format="ICO", sizes=[(32, 32)])
    except Exception:
        pass
