import requests
from bs4 import BeautifulSoup
import random
import time
from typing import List, Dict
from models import User, Zone
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
import redis

class HonorOfKingsCrawler:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        self.engine = create_engine('mysql+pymysql://game_user:game_password@localhost/game_leaderboard')
        self.Session = sessionmaker(bind=self.engine)
        self.redis_conn = redis.Redis(host='localhost', port=6379, db=0)

    def crawl_ranking_data(self) -> List[Dict]:
        """模拟爬取王者荣耀排行榜数据"""
        try:
            # 这里模拟从官网爬取数据（实际需要分析目标网站结构）
            print("开始爬取王者荣耀排行榜数据...")
            
            # 模拟数据 - 实际项目应替换为真实爬取逻辑
            zones = ["王者峡谷", "荣耀战区", "巅峰对决"]
            mock_data = []
            
            for i in range(1, 51):  # 生成50条模拟数据
                zone = random.choice(zones)
                mock_data.append({
                    "nickname": f"玩家{i}",
                    "avatar_url": f"https://game.gtimg.cn/images/horizon/act/a{random.randint(1,10)}.jpg",
                    "zone": zone,
                    "score": random.randint(800, 2500),
                    "hero_level": random.randint(5, 30),
                    "win_rate": round(random.uniform(0.45, 0.85), 2)
                })
                time.sleep(0.1)  # 防止请求过快
            
            print(f"成功爬取{len(mock_data)}条数据")
            return mock_data
            
        except Exception as e:
            print(f"爬取失败: {e}")
            return []

    def import_to_database(self, data: List[Dict]):
        """将数据导入数据库"""
        session = self.Session()
        try:
            # 确保战区存在
            zone_map = {z.name: z.id for z in session.query(Zone).all()}
            
            users = []
            for item in data:
                zone_name = item['zone']
                if zone_name not in zone_map:
                    new_zone = Zone(name=zone_name, level=random.randint(1, 5))
                    session.add(new_zone)
                    session.flush()
                    zone_map[zone_name] = new_zone.id
                
                users.append(User(
                    nickname=item['nickname'],
                    avatar_url=item['avatar_url'],
                    current_zone_id=zone_map[zone_name],
                    total_score=item['score'],
                    hero_level=item['hero_level'],
                    win_rate=item['win_rate']
                ))
            
            # 批量插入
            session.bulk_save_objects(users)
            session.commit()
            print(f"成功导入{len(users)}条数据到MySQL")
            
            # 导入Redis
            with self.redis_conn.pipeline() as pipe:
                for user, item in zip(users, data):
                    # 全局排行榜
                    pipe.zadd("global_leaderboard", {str(user.id): item['score']})
                    # 战区排行榜
                    zone_key = f"zone_leaderboard:{zone_map[item['zone']]}"
                    pipe.zadd(zone_key, {str(user.id): item['score']})
                pipe.execute()
            print("成功导入数据到Redis")
            
        except Exception as e:
            session.rollback()
            print(f"导入失败: {e}")
        finally:
            session.close()

if __name__ == '__main__':
    crawler = HonorOfKingsCrawler()
    data = crawler.crawl_ranking_data()
    if data:
        crawler.import_to_database(data)