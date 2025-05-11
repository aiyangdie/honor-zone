#!/usr/bin/env python3
"""
测试数据整合功能
验证Redis和MySQL数据能否正确整合
"""
import sys
import json
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import redis
import re

# 颜色输出函数
def print_success(msg):
    print(f"\033[92m✓ {msg}\033[0m")

def print_error(msg):
    print(f"\033[91m✗ {msg}\033[0m")

def print_info(msg):
    print(f"\033[94mℹ {msg}\033[0m")

def print_section(title):
    print(f"\n\033[1m=== {title} ===\033[0m")

def test_redis_connection():
    """测试Redis连接"""
    print_section("测试Redis连接")
    try:
        # 使用IP地址避免DNS解析问题
        r = redis.Redis(
            host='127.0.0.1',
            port=6379,
            socket_connect_timeout=3,
            decode_responses=True
        )
        
        # 测试连接
        if r.ping():
            print_success("Redis连接成功")
        else:
            print_error("Redis连接失败: ping()返回False")
            return False
        
        # 检查排行榜数据
        global_leaderboard = r.zrevrange("global_leaderboard", 0, 4, withscores=True)
        if global_leaderboard:
            print_success(f"全局排行榜数据存在: {len(global_leaderboard)}条记录")
            print_info(f"前5名: {global_leaderboard}")
        else:
            print_error("全局排行榜数据不存在")
            return False
            
        return True
    except redis.RedisError as e:
        print_error(f"Redis连接错误: {e}")
        return False

def test_mysql_connection():
    """测试MySQL连接"""
    print_section("测试MySQL连接")
    try:
        # 创建数据库连接
        engine = create_engine('mysql+pymysql://game_user:game_password@localhost/game_leaderboard')
        
        # 测试连接
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1")).scalar()
            if result == 1:
                print_success("MySQL连接成功")
            else:
                print_error(f"MySQL连接测试返回: {result}")
                return False, None
        
        # 创建会话
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # 检查用户数据
        user_count = session.execute(text("SELECT COUNT(*) FROM users")).scalar()
        if user_count > 0:
            print_success(f"用户数据存在: {user_count}条记录")
        else:
            print_error("用户数据不存在")
            return False, None
            
        return True, session
    except Exception as e:
        print_error(f"MySQL连接错误: {e}")
        return False, None

def test_data_integration():
    """测试数据整合"""
    print_section("测试数据整合")
    
    # 测试Redis连接
    redis_ok = test_redis_connection()
    if not redis_ok:
        print_error("Redis连接失败，无法继续测试")
        return False
    
    # 测试MySQL连接
    mysql_ok, session = test_mysql_connection()
    if not mysql_ok:
        print_error("MySQL连接失败，无法继续测试")
        return False
    
    try:
        # 从Redis获取排行榜数据
        r = redis.Redis(host='127.0.0.1', port=6379, decode_responses=True)
        
        # 检查排行榜是否存在
        keys = r.keys("*leaderboard*")
        print_info(f"Redis中的排行榜键: {keys}")
        
        # 获取排行榜数据
        leaderboard_data = r.zrevrange("global_leaderboard", 0, 9, withscores=True)
        print_info(f"从Redis获取了{len(leaderboard_data)}条排行榜数据: {leaderboard_data}")
        
        # 提取用户ID
        user_ids = []
        for member, score in leaderboard_data:
            try:
                user_id = member #re.findall(r'\d+', member)
                user_ids.append(user_id)
            except ValueError:
                print_error(f"无效的用户ID: {member}")
        
        print_info(f"提取了{len(user_ids)}个有效用户ID: {user_ids[:5]}...")
        
        # 从MySQL获取用户详情
        if user_ids:
            try:
                # 检查users表结构
                columns = session.execute(text("SHOW COLUMNS FROM users")).fetchall()
                print_info(f"users表结构: {[col[0] for col in columns]}")
                
                # 检查是否有匹配的用户
                for user_id in user_ids[:3]:  # 只检查前3个ID
                    check = session.execute(text(f"SELECT COUNT(*) FROM users WHERE id = {user_id}")).scalar()
                    print_info(f"用户ID {user_id} 在数据库中: {'存在' if check > 0 else '不存在'}")
                
                # 使用IN查询
                if len(user_ids) == 1:
                    # 单个ID使用等于查询
                    stmt = text(f"SELECT * FROM users WHERE id = {user_ids[0]}")
                else:
                    # 多个ID使用IN查询
                    id_str = ','.join(str(id) for id in user_ids)
                    stmt = text(f"SELECT * FROM users WHERE id IN ({id_str})")
                
                print_info(f"执行SQL: {stmt}")
                users = session.execute(stmt).fetchall()
                
                # 检查返回的用户数据
                print_info(f"查询返回了{len(users)}条用户记录")
                if users:
                    first_user = users[0]
                    print_info(f"第一条用户记录: ID={first_user.id}, 昵称={first_user.nickname}")
                
                # 创建用户映射
                user_map = {}
                for user in users:
                    user_map[user.id] = user
                    
                print_info(f"从MySQL获取了{len(user_map)}条用户数据, 用户ID: {list(user_map.keys())}")
            except Exception as e:
                print_error(f"MySQL查询错误: {e}")
                return False
            
            # 整合数据
            integrated_data = []
            for member, score in leaderboard_data:
                try:
                    user_id = member #int(member)
                    if user_id in user_map:
                        user = user_map[user_id]
                        integrated_data.append({
                            'user_id': user_id,
                            'score': score,
                            'user_info': {
                                'nickname': user.nickname,
                                'avatar_url': user.avatar_url,
                                'current_zone_id': user.current_zone_id,
                                'hero_level': getattr(user, 'hero_level', 1),
                                'win_rate': getattr(user, 'win_rate', 0.5)
                            }
                        })
                except (ValueError, TypeError) as e:
                    print_error(f"数据整合错误: {e}")
            
            print_info(f"成功整合{len(integrated_data)}条数据")
            
            # 验证整合结果
            if len(integrated_data) > 0:
                print_success("数据整合成功")
                print_info("整合后的第一条数据:")
                print(json.dumps(integrated_data[0], indent=2, ensure_ascii=False))
                return True
            else:
                print_error("数据整合失败: 没有成功整合的数据")
                return False
        else:
            print_error("没有有效的用户ID，无法继续测试")
            return False
            
    except Exception as e:
        print_error(f"数据整合测试失败: {e}")
        return False
    finally:
        if session:
            session.close()

if __name__ == "__main__":
    print("\n🔍 开始测试数据整合功能...")
    success = test_data_integration()
    
    if success:
        print("\n✅ 所有测试通过！数据整合功能正常工作。")
        sys.exit(0)
    else:
        print("\n❌ 测试失败！请检查错误信息。")
        sys.exit(1)