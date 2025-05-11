from flask import Flask, request, jsonify, render_template
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from models import Base, User, Zone
import redis
import json
import os

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

# 创建数据库引擎和会话
engine = create_engine(f'mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}')
session_factory = sessionmaker(bind=engine)
Session = scoped_session(session_factory)

# 创建Redis连接
redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)

# 确保表存在
Base.metadata.create_all(engine)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api')
def api_index():
    return jsonify({
        "status": "success",
        "message": "王者荣耀战区排行榜系统API服务正在运行"
    })

@app.route('/api/users', methods=['POST'])
def create_user():
    """创建新用户"""
    data = request.json
    if not data or 'nickname' not in data:
        return jsonify({"status": "error", "message": "昵称不能为空"}), 400
    
    try:
        session = Session()
        user = User(
            nickname=data['nickname'],
            avatar_url=data.get('avatar_url'),
            current_zone_id=data.get('current_zone_id', 0),
            total_score=data.get('total_score', 0)
        )
        session.add(user)
        session.commit()
        
        # 同步到Redis
        if user.current_zone_id > 0:
            redis_client.zadd(f"zone:{user.current_zone_id}:leaderboard", {user.id: user.total_score})
        
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
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        session.close()

@app.route('/api/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    """获取用户信息"""
    try:
        session = Session()
        user = session.query(User).filter_by(id=user_id).first()
        if not user:
            return jsonify({"status": "error", "message": "用户不存在"}), 404
        
        return jsonify({
            "status": "success",
            "data": {
                "id": user.id,
                "nickname": user.nickname,
                "avatar_url": user.avatar_url,
                "current_zone_id": user.current_zone_id,
                "total_score": user.total_score,
                "created_at": user.created_at.isoformat() if user.created_at else None
            }
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        session.close()

@app.route('/api/zones', methods=['POST'])
def create_zone():
    """创建新战区"""
    data = request.json
    if not data or 'name' not in data:
        return jsonify({"status": "error", "message": "战区名称不能为空"}), 400
    
    try:
        session = Session()
        zone = Zone(
            name=data['name'],
            level=data.get('level', 1)
        )
        session.add(zone)
        session.commit()
        
        return jsonify({
            "status": "success", 
            "message": "战区创建成功",
            "data": {
                "id": zone.id,
                "name": zone.name,
                "level": zone.level
            }
        }), 201
    except Exception as e:
        session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        session.close()

@app.route('/api/scores/update', methods=['POST'])
def update_score():
    """更新用户分数"""
    data = request.json
    if not data or 'user_id' not in data or 'score' not in data:
        return jsonify({"status": "error", "message": "用户ID和分数不能为空"}), 400
    
    try:
        user_id = data['user_id']
        score = int(data['score'])
        
        session = Session()
        user = session.query(User).filter_by(id=user_id).first()
        if not user:
            return jsonify({"status": "error", "message": "用户不存在"}), 404
        
        # 更新MySQL中的分数
        user.total_score += score
        session.commit()
        
        # 同步到Redis
        if user.current_zone_id > 0:
            redis_client.zadd(f"zone:{user.current_zone_id}:leaderboard", {user.id: user.total_score})
        
        return jsonify({
            "status": "success",
            "message": "分数更新成功",
            "data": {
                "user_id": user.id,
                "new_score": user.total_score
            }
        })
    except Exception as e:
        session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        session.close()

@app.route('/api/leaderboard/zone/<int:zone_id>', methods=['GET'])
def get_zone_leaderboard(zone_id):
    """获取战区排行榜"""
    try:
        # 获取参数
        start = int(request.args.get('start', 0))
        end = int(request.args.get('end', 9))  # 默认前10名
        
        # 从Redis获取排行榜数据
        leaderboard_key = f"zone:{zone_id}:leaderboard"
        
        # 检查Redis中是否有数据，如果没有则从MySQL同步
        if redis_client.zcard(leaderboard_key) == 0:
            session = Session()
            users = session.query(User).filter_by(current_zone_id=zone_id).all()
            
            # 将数据同步到Redis
            if users:
                redis_data = {user.id: user.total_score for user in users}
                redis_client.zadd(leaderboard_key, redis_data)
            
            session.close()
        
        # 获取排行榜数据(按分数降序)
        leaderboard_data = redis_client.zrevrange(
            leaderboard_key, start, end, withscores=True
        )
        
        # 获取用户详细信息
        result = []
        if leaderboard_data:
            session = Session()
            for user_id_bytes, score in leaderboard_data:
                user_id = int(user_id_bytes)
                user = session.query(User).filter_by(id=user_id).first()
                if user:
                    result.append({
                        "rank": start + len(result) + 1,
                        "user_id": user.id,
                        "nickname": user.nickname,
                        "avatar_url": user.avatar_url,
                        "score": int(score)
                    })
            session.close()
        
        return jsonify({
            "status": "success",
            "data": {
                "zone_id": zone_id,
                "leaderboard": result
            }
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)