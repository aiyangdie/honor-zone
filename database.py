"""数据库连接与战区数据修复（utf8mb4）"""
import os
import re

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, scoped_session

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

DB_USER = os.environ.get("DB_USER", "game_user")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "game_password")
DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_NAME = os.environ.get("DB_NAME", "game_leaderboard")

# 标准演示战区（唯一权威名称列表）
CANONICAL_ZONES = [
    ("宁夏·银川", 1),
    ("青海·西宁", 1),
    ("西藏·拉萨", 1),
    ("低分无人区", 1),
    ("荣耀战区-测试", 1),
]

_GARBLE_RE = re.compile(r"^[\s?？]+$")


def build_database_url() -> str:
    return (
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}"
        f"?charset=utf8mb4"
    )


def create_db_engine():
    return create_engine(
        build_database_url(),
        pool_pre_ping=True,
        connect_args={"charset": "utf8mb4", "use_unicode": True},
        json_serializer=None,
    )


engine = create_db_engine()
Session = scoped_session(sessionmaker(bind=engine))


def is_garbled_zone_name(name: str) -> bool:
    if not name:
        return True
    stripped = name.strip()
    if _GARBLE_RE.match(stripped):
        return True
    if stripped in ("????", "???", "??", "?"):
        return True
    # 含中文或常见标点则视为正常
    if re.search(r"[\u4e00-\u9fff·\-]", name):
        return False
    # 含问号且无中文
    if "?" in name or "？" in name:
        return True
    return False


def sync_zone_leaderboards(session, redis_client) -> None:
    """将 MySQL 用户积分同步到 Redis 战区榜"""
    from models import Zone, User

    for zone in session.query(Zone).order_by(Zone.id).all():
        key = f"zone:{zone.id}:leaderboard"
        redis_client.delete(key)
        users = session.query(User).filter_by(current_zone_id=zone.id).all()
        if users:
            redis_client.zadd(key, {user.id: user.total_score for user in users})


def repair_zones_and_encoding(session, redis_client) -> dict:
    """
    修复乱码战区名、合并重复项、保证标准战区存在。
    返回修复统计供日志使用。
    """
    from models import Zone, User

    session.execute(text("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"))

    stats = {"deleted_garbled": 0, "merged_duplicates": 0, "created": 0, "users_reassigned": 0}

    # 1. 确保标准战区存在（按名称 upsert）
    canonical_by_name = {}
    for name, level in CANONICAL_ZONES:
        zone = session.query(Zone).filter(Zone.name == name).first()
        if not zone:
            zone = Zone(name=name, level=level)
            session.add(zone)
            session.flush()
            stats["created"] += 1
        canonical_by_name[name] = zone

    session.flush()

    # 2. 按名称保留最小 id，合并重复
    name_to_keep_id = {}
    for zone in session.query(Zone).order_by(Zone.id).all():
        if is_garbled_zone_name(zone.name):
            continue
        if zone.name not in name_to_keep_id:
            name_to_keep_id[zone.name] = zone.id

    default_zone_id = canonical_by_name[CANONICAL_ZONES[0][0]].id

    for zone in session.query(Zone).order_by(Zone.id).all():
        if is_garbled_zone_name(zone.name):
            count = (
                session.query(User)
                .filter_by(current_zone_id=zone.id)
                .update({User.current_zone_id: default_zone_id}, synchronize_session=False)
            )
            stats["users_reassigned"] += count
            session.delete(zone)
            stats["deleted_garbled"] += 1
            continue

        keep_id = name_to_keep_id.get(zone.name)
        if keep_id and zone.id != keep_id:
            count = (
                session.query(User)
                .filter_by(current_zone_id=zone.id)
                .update({User.current_zone_id: keep_id}, synchronize_session=False)
            )
            stats["users_reassigned"] += count
            session.delete(zone)
            stats["merged_duplicates"] += 1

    session.commit()
    sync_zone_leaderboards(session, redis_client)
    return stats
