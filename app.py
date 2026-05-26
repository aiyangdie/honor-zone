import os
import redis

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from flask import Flask, request, jsonify, render_template, send_from_directory
from models import Base, User, Zone
from database import (
    engine,
    Session,
    is_garbled_zone_name,
    repair_zones_and_encoding,
    sync_zone_leaderboards,
    CANONICAL_ZONES,
)
from health import build_service_status, ensure_favicon
from hero_api import (
    fetch_hero_list,
    fetch_hero_power,
    fetch_hero_power_all_platforms,
    get_api_status,
    HERO_TYPES,
)
from security import rate_limit, require_write_auth, safe_message

app = Flask(__name__, template_folder='templates', static_folder='static')

# 数据库配置
DB_USER = os.environ.get('DB_USER', 'game_user')
DB_PASSWORD = os.environ.get('DB_PASSWORD', 'game_password')
DB_HOST = os.environ.get('DB_HOST', 'localhost')
DB_NAME = os.environ.get('DB_NAME', 'game_leaderboard')

# Redis配置
REDIS_HOST = os.environ.get('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.environ.get('REDIS_PORT', 6379))
REDIS_DB = int(os.environ.get('REDIS_DB', 0))

# 创建Redis连接
redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB, decode_responses=False)

FLASK_DEBUG = os.environ.get("FLASK_DEBUG", "false").lower() in ("1", "true", "yes")
FLASK_PORT = int(os.environ.get("FLASK_PORT", 5000))
ENABLE_DEMO_API = os.environ.get("ENABLE_DEMO_API", "true").lower() in ("1", "true", "yes")

ensure_favicon(app.static_folder)

# 确保表存在
try:
    Base.metadata.create_all(engine)
except Exception as exc:
    app.logger.error("数据库初始化失败: %s", exc)


def seed_demo_data():
    """数据库为空时写入演示战区与用户"""
    session = Session()
    try:
        if session.query(Zone).count() > 0:
            return False

        demo_zones = list(CANONICAL_ZONES)
        zones = []
        for name, level in demo_zones:
            zone = Zone(name=name, level=level)
            session.add(zone)
            zones.append(zone)
        session.flush()

        demo_users = [
            ("最强王者", 9800, 0),
            ("荣耀王者", 8500, 0),
            ("无双王者", 7200, 1),
            ("巅峰选手", 6800, 2),
            ("冲标萌新", 4200, 3),
        ]
        for nickname, score, zone_idx in demo_users:
            user = User(
                nickname=nickname,
                current_zone_id=zones[zone_idx].id,
                total_score=score,
            )
            session.add(user)
        session.commit()

        for zone in zones:
            users = session.query(User).filter_by(current_zone_id=zone.id).all()
            if users:
                redis_client.zadd(
                    f"zone:{zone.id}:leaderboard",
                    {user.id: user.total_score for user in users},
                )
        return True
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


seed_demo_data()


def _init_database():
    """启动时修复 utf8mb4 乱码战区并同步 Redis 榜"""
    session = Session()
    try:
        repair_zones_and_encoding(session, redis_client)
    except Exception as exc:
        app.logger.warning("战区数据修复跳过: %s", exc)
    finally:
        session.close()


_init_database()


def _demo_api_allowed() -> bool:
    return ENABLE_DEMO_API


def _service_snapshot(hero_online: bool = False) -> dict:
    return build_service_status(engine, redis_client, hero_online=hero_online)


@app.after_request
def _utf8_json(response):
    """API JSON 明确使用 UTF-8"""
    if response.content_type and "application/json" in response.content_type:
        response.charset = "utf-8"
    return response


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/health', methods=['GET'])
def api_health():
    """MySQL / Redis / 战力接口 / 局域网访问地址"""
    hero_online = False
    try:
        raw = get_api_status(light=True)
        hero_online = bool(raw.get("healthy"))
    except Exception:
        pass
    return jsonify({"status": "success", "data": _service_snapshot(hero_online)})


@app.route('/favicon.ico', endpoint='site_favicon')
def serve_favicon():
    static_dir = app.static_folder
    ico_path = os.path.join(static_dir, 'favicon.ico')
    if os.path.isfile(ico_path):
        return send_from_directory(
            static_dir,
            'favicon.ico',
            mimetype='image/vnd.microsoft.icon',
        )
    png_path = os.path.join(static_dir, 'favicon-32.png')
    if os.path.isfile(png_path):
        return send_from_directory(
            static_dir,
            'favicon-32.png',
            mimetype='image/png',
        )
    return send_from_directory(static_dir, 'favicon.svg', mimetype='image/svg+xml')


def _public_power(data: dict) -> dict:
    """面向用户接口：不暴露数据来源等内部字段"""
    return {
        "hero": data.get("hero"),
        "alias": data.get("alias"),
        "platform": data.get("platform"),
        "platform_id": data.get("platform_id"),
        "photo": data.get("photo"),
        "province": data.get("province"),
        "province_power": data.get("province_power"),
        "city": data.get("city"),
        "city_power": data.get("city_power"),
        "area": data.get("area"),
        "area_power": data.get("area_power"),
        "guobiao": data.get("guobiao"),
        "updated_at": data.get("updated_at"),
    }


@app.route('/api')
def api_index():
    return jsonify({
        "status": "success",
        "message": "荣耀战区助手 API",
        "endpoints": {
            "heroes": "GET /api/heroes",
            "platforms": "GET /api/platforms",
            "power": "GET /api/hero/power?hero=李白&type=aqq",
            "power_all": "GET /api/hero/power/all?hero=李白",
            "status": "GET /api/hero/status",
            "zones": "GET/POST /api/zones",
            "leaderboard": "GET /api/leaderboard/zone/<zone_id>",
            "users": "POST /api/users",
            "user": "GET /api/users/<user_id>",
            "scores": "POST /api/scores/update",
            "seed": "POST /api/seed (需 ENABLE_DEMO_API)",
            "health": "GET /api/health",
        },
    })

@app.route('/api/users', methods=['POST'])
@rate_limit("write", 30)
@require_write_auth
def create_user():
    """创建新用户"""
    data = request.json
    if not data or not str(data.get('nickname', '')).strip():
        return jsonify({"status": "error", "message": "昵称不能为空"}), 400

    zone_id = int(data.get('current_zone_id') or 0)
    if zone_id <= 0:
        return jsonify({"status": "error", "message": "请选择有效战区"}), 400

    session = Session()
    try:
        zone = session.query(Zone).filter_by(id=zone_id).first()
        if not zone or is_garbled_zone_name(zone.name):
            return jsonify({"status": "error", "message": "战区不存在"}), 400

        user = User(
            nickname=str(data['nickname']).strip()[:50],
            avatar_url=data.get('avatar_url') or None,
            current_zone_id=zone_id,
            total_score=max(0, int(data.get('total_score', 0))),
        )
        session.add(user)
        session.commit()

        if user.current_zone_id > 0:
            redis_client.zadd(
                f"zone:{user.current_zone_id}:leaderboard",
                {user.id: user.total_score},
            )

        return jsonify({
            "status": "success",
            "message": "用户创建成功",
            "data": {
                "id": user.id,
                "nickname": user.nickname
            }
        }), 201
    except Exception as e:
        session.rollback()
        return jsonify({"status": "error", "message": safe_message(e)}), 500
    finally:
        session.close()

@app.route('/api/users/<int:user_id>', methods=['GET'])
@rate_limit("read", 60)
def get_user(user_id):
    """获取用户信息"""
    session = Session()
    try:
        user = session.query(User).filter_by(id=user_id).first()
        if not user:
            return jsonify({"status": "error", "message": "用户不存在"}), 404

        zone_name = None
        zone_rank = None
        zone_total = None
        if user.current_zone_id:
            zone = session.query(Zone).filter_by(id=user.current_zone_id).first()
            if zone and not is_garbled_zone_name(zone.name):
                zone_name = zone.name
            lb_key = f"zone:{user.current_zone_id}:leaderboard"
            try:
                zone_total = redis_client.zcard(lb_key)
                rk = redis_client.zrevrank(lb_key, user.id)
                if rk is not None:
                    zone_rank = int(rk) + 1
            except Exception:
                pass

        return jsonify({
            "status": "success",
            "data": {
                "id": user.id,
                "nickname": user.nickname,
                "avatar_url": user.avatar_url,
                "current_zone_id": user.current_zone_id,
                "zone_name": zone_name,
                "zone_rank": zone_rank,
                "zone_total": zone_total,
                "total_score": user.total_score,
                "hero_level": user.hero_level,
                "win_rate": user.win_rate,
                "created_at": user.created_at.isoformat() if user.created_at else None,
            },
        })
    except Exception as e:
        return jsonify({"status": "error", "message": safe_message(e)}), 500
    finally:
        session.close()

@app.route('/api/zones', methods=['GET', 'POST'])
def zones():
    """获取或创建战区"""
    if request.method == 'GET':
        try:
            session = Session()
            zone_list = (
                session.query(Zone)
                .order_by(Zone.id)
                .all()
            )
            zones = [
                {"id": zone.id, "name": zone.name, "level": zone.level}
                for zone in zone_list
                if not is_garbled_zone_name(zone.name)
            ]
            return jsonify({
                "status": "success",
                "data": {"zones": zones},
            })
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500
        finally:
            session.close()

    if not _demo_api_allowed():
        return jsonify({"status": "error", "message": "演示写入接口已关闭"}), 403

    return _create_zone_impl()

@require_write_auth
@rate_limit("write", 30)
def _create_zone_impl():
    data = request.json or {}
    name = str(data.get('name', '')).strip()[:50]
    if not name:
        return jsonify({"status": "error", "message": "战区名称不能为空"}), 400
    if is_garbled_zone_name(name):
        return jsonify({"status": "error", "message": "战区名称无效"}), 400

    session = Session()
    try:
        if session.query(Zone).filter_by(name=name).first():
            return jsonify({"status": "error", "message": "该战区名称已存在"}), 409

        zone = Zone(name=name, level=int(data.get('level', 1)))
        session.add(zone)
        session.commit()

        return jsonify({
            "status": "success",
            "message": "战区创建成功",
            "data": {
                "id": zone.id,
                "name": zone.name,
                "level": zone.level,
            },
        }), 201
    except Exception as e:
        session.rollback()
        return jsonify({"status": "error", "message": safe_message(e)}), 500
    finally:
        session.close()

@app.route('/api/scores/update', methods=['POST'])
@rate_limit("write", 40)
@require_write_auth
def update_score():
    """更新用户分数"""
    data = request.json or {}
    if 'user_id' not in data or 'score' not in data:
        return jsonify({"status": "error", "message": "用户ID和分数不能为空"}), 400

    try:
        user_id = int(data['user_id'])
        score = int(data['score'])
    except (TypeError, ValueError):
        return jsonify({"status": "error", "message": "用户 ID 或积分格式无效"}), 400

    session = Session()
    try:
        user = session.query(User).filter_by(id=user_id).first()
        if not user:
            return jsonify({"status": "error", "message": "用户不存在"}), 404

        user.total_score += score
        session.commit()

        if user.current_zone_id > 0:
            redis_client.zadd(
                f"zone:{user.current_zone_id}:leaderboard",
                {user.id: user.total_score},
            )

        return jsonify({
            "status": "success",
            "message": "分数更新成功",
            "data": {
                "user_id": user.id,
                "new_score": user.total_score,
            },
        })
    except Exception as e:
        session.rollback()
        return jsonify({"status": "error", "message": safe_message(e)}), 500
    finally:
        session.close()

@app.route('/api/leaderboard/zone/<int:zone_id>', methods=['GET'])
def get_zone_leaderboard(zone_id):
    """获取战区排行榜"""
    session = Session()
    try:
        start = max(0, int(request.args.get('start', 0)))
        end = max(start, int(request.args.get('end', 19)))

        zone = session.query(Zone).filter_by(id=zone_id).first()
        if not zone or is_garbled_zone_name(zone.name):
            return jsonify({"status": "error", "message": "战区不存在或数据无效"}), 404

        leaderboard_key = f"zone:{zone_id}:leaderboard"

        if redis_client.zcard(leaderboard_key) == 0:
            users = session.query(User).filter_by(current_zone_id=zone_id).all()
            if users:
                redis_client.zadd(
                    leaderboard_key,
                    {user.id: user.total_score for user in users},
                )
        
        # 获取排行榜数据(按分数降序)
        leaderboard_data = redis_client.zrevrange(
            leaderboard_key, start, end, withscores=True
        )
        
        result = []
        users_by_id = {}
        if leaderboard_data:
            user_ids = [int(uid) for uid, _ in leaderboard_data]
            users = session.query(User).filter(User.id.in_(user_ids)).all()
            users_by_id = {u.id: u for u in users}
            for user_id_bytes, score in leaderboard_data:
                user_id = int(user_id_bytes)
                user = users_by_id.get(user_id)
                if user:
                    result.append({
                        "rank": start + len(result) + 1,
                        "user_id": user.id,
                        "nickname": user.nickname,
                        "avatar_url": user.avatar_url,
                        "score": int(score),
                    })

        total = redis_client.zcard(leaderboard_key)
        has_more = (end + 1) < total

        return jsonify({
            "status": "success",
            "data": {
                "zone_id": zone_id,
                "zone_name": zone.name,
                "leaderboard": result,
                "total": total,
                "start": start,
                "end": min(end, total - 1) if total else end,
                "has_more": has_more,
            },
        })
    except Exception as e:
        return jsonify({"status": "error", "message": safe_message(e)}), 500
    finally:
        session.close()

@app.route('/api/seed', methods=['POST'])
@rate_limit("write", 10)
@require_write_auth
def seed_data():
    """手动写入演示数据（不删除已有数据）"""
    if not _demo_api_allowed():
        return jsonify({"status": "error", "message": "演示导入接口已关闭"}), 403

    session = Session()
    try:
        created = {"zones": 0, "users": 0}
        existing_names = {z.name for z in session.query(Zone).all()}
        zones = list(session.query(Zone).order_by(Zone.id).all())
        for name, level in CANONICAL_ZONES:
            if name not in existing_names:
                zone = Zone(name=name, level=level)
                session.add(zone)
                zones.append(zone)
                created["zones"] += 1
        session.flush()
        zones = list(session.query(Zone).order_by(Zone.id).all())

        if session.query(User).count() < 3 and zones:
            demo_users = [
                ("最强王者", 9800, 0),
                ("荣耀王者", 8500, 0),
                ("无双王者", 7200, min(1, len(zones) - 1)),
                ("巅峰选手", 6800, min(2, len(zones) - 1)),
            ]
            for nickname, score, zone_idx in demo_users:
                user = User(
                    nickname=nickname,
                    current_zone_id=zones[zone_idx].id,
                    total_score=score,
                )
                session.add(user)
                created["users"] += 1
        session.commit()

        sync_zone_leaderboards(session, redis_client)

        return jsonify({"status": "success", "message": "演示数据已导入", "data": created})
    except Exception as e:
        session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        session.close()


@app.route('/api/heroes', methods=['GET'])
@rate_limit("read", 40)
def list_heroes():
    """获取英雄列表（公开数据源）"""
    try:
        result = fetch_hero_list()
        return jsonify({
            "status": "success",
            "data": {
                "heroes": result["heroes"],
                "count": result["count"],
            }
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 502


@app.route('/api/hero/status', methods=['GET'])
def hero_api_status():
    """服务是否可用（不暴露内部数据源信息）"""
    raw = get_api_status(light=True)
    hero_online = bool(raw.get("healthy"))
    data = _service_snapshot(hero_online)
    data["online"] = hero_online
    return jsonify({"status": "success", "data": data})


@app.route('/api/hero/power', methods=['GET'])
@rate_limit("hero")
def hero_power():
    """查询英雄最低战力战区（公开数据源）"""
    hero = (request.args.get('hero') or '').strip()
    platform_type = (request.args.get('type') or 'aqq').strip()
    if not hero:
        return jsonify({"status": "error", "message": "请提供英雄名称"}), 400
    try:
        data = fetch_hero_power(hero, platform_type)
        return jsonify({"status": "success", "data": _public_power(data)})
    except ValueError as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 502


@app.route('/api/hero/power/all', methods=['GET'])
@rate_limit("hero")
def hero_power_all():
    """一次查询四个大区的最低战力（真实第三方数据）"""
    hero = (request.args.get('hero') or '').strip()
    if not hero:
        return jsonify({"status": "error", "message": "请提供英雄名称"}), 400
    try:
        raw = fetch_hero_power_all_platforms(hero)
        platforms = {
            k: _public_power(v) for k, v in raw.get("platforms", {}).items()
        }
        return jsonify({
            "status": "success",
            "data": {
                "hero": raw.get("hero"),
                "platforms": platforms,
                "success_count": raw.get("success_count", 0),
            },
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 502


@app.route('/api/platforms', methods=['GET'])
def list_platforms():
    return jsonify({
        "status": "success",
        "data": {
            "platforms": [
                {"id": k, "name": v["name"], "short": v.get("short", "")}
                for k, v in HERO_TYPES.items()
            ],
        },
    })

if __name__ == '__main__':
    snap = _service_snapshot()
    print("=" * 48)
    print("荣耀战区 Web 服务")
    print(f"  本机访问: {snap['local_url']}")
    print(f"  手机访问: {snap['lan_url']}  (需同一 WiFi)")
    print(f"  MySQL: {'就绪' if snap['mysql'] else '未连接 — 排行榜/用户不可用'}")
    print(f"  Redis: {'就绪' if snap['redis'] else '未连接 — 排行榜不可用'}")
    print(f"  调试模式: {'开' if FLASK_DEBUG else '关'}")
    print("=" * 48)
    app.run(debug=FLASK_DEBUG, host='0.0.0.0', port=FLASK_PORT)