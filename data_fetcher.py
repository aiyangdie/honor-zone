import requests
import random
from typing import List, Dict
from models import User, Zone
from datetime import datetime

class HonorOfKingsDataFetcher:
    @staticmethod
    def fetch_real_rankings() -> List[Dict]:
        """从公开API获取王者荣耀排行榜数据"""
        try:
            # 这里使用模拟API地址，实际使用时需要替换为真实API
            api_url = "https://api.honorofkings.com/rankings"  # 示例URL
            response = requests.get(api_url, timeout=5)
            response.raise_for_status()
            
            # 假设API返回格式为：
            # [{"nickname": "玩家1", "avatar": "url", "zone": "战区1", "score": 100}, ...]
            return response.json()
            
        except Exception as e:
            print(f"获取真实数据失败: {e}")
            return []

    @staticmethod
    def generate_mock_data(count=20) -> List[Dict]:
        """生成模拟排行榜数据"""
        zones = ["王者峡谷", "荣耀战区", "巅峰对决"]
        return [
            {
                "nickname": f"玩家{i}",
                "avatar": f"https://game.gtimg.cn/images/horizon/act/a{random.randint(1,10)}.jpg",
                "zone": random.choice(zones),
                "score": random.randint(800, 1500)
            }
            for i in range(1, count+1)
        ]

    @classmethod
    def get_rankings_data(cls) -> List[Dict]:
        """获取排行榜数据（优先真实数据，失败则用模拟数据）"""
        return cls.fetch_real_rankings() or cls.generate_mock_data()

class DataImporter:
    @staticmethod
    def import_to_database(data: List[Dict], db_session):
        """将数据导入数据库"""
        try:
            # 确保战区存在
            zone_map = {}
            for zone in db_session.query(Zone).all():
                zone_map[zone.name] = zone.id
            
            # 处理每个玩家数据
            users = []
            for item in data:
                zone_name = item['zone']
                if zone_name not in zone_map:
                    new_zone = Zone(name=zone_name, level=1)
                    db_session.add(new_zone)
                    db_session.commit()
                    zone_map[zone_name] = new_zone.id
                
                users.append(User(
                    nickname=item['nickname'],
                    avatar_url=item['avatar'],
                    current_zone_id=zone_map[zone_name],
                    total_score=item['score'],
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                ))
            
            # 批量插入用户
            db_session.bulk_save_objects(users)
            db_session.commit()
            return True
            
        except Exception as e:
            db_session.rollback()
            print(f"数据导入失败: {e}")
            return False

    @classmethod
    def import_to_redis(cls, data: List[Dict], redis_conn):
        """将数据导入Redis"""
        try:
            with redis_conn.pipeline() as pipe:
                for item in data:
                    user_id = f"user_{item['nickname']}"  # 临时ID，实际应用需要真实用户ID
                    # 全局排行榜
                    pipe.zadd("global_leaderboard", {user_id: item['score']})
                    # 战区排行榜
                    zone_key = f"zone_leaderboard:{item['zone']}"
                    pipe.zadd(zone_key, {user_id: item['score']})
                pipe.execute()
            return True
        except Exception as e:
            print(f"Redis导入失败: {e}")
            return False