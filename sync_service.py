#!/usr/bin/env python3
"""
数据同步服务 - 负责在Redis和MySQL之间同步排行榜数据
"""
import os
import time
import logging
import redis
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import User, Zone
from dotenv import load_dotenv

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("sync_service.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("sync_service")

# 加载环境变量
load_dotenv()

# 数据库配置
DB_USER = os.environ.get('DB_USER', 'game_user')
DB_PASSWORD = os.environ.get('DB_PASSWORD', 'game_password')
DB_HOST = os.environ.get('DB_HOST', 'localhost')
DB_NAME = os.environ.get('DB_NAME', 'game_leaderboard')

# Redis配置
REDIS_HOST = os.environ.get('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.environ.get('REDIS_PORT', 6379))
REDIS_DB = int(os.environ.get('REDIS_DB', 0))

# 同步间隔(秒)
SYNC_INTERVAL = int(os.environ.get('SYNC_INTERVAL', 300))  # 默认5分钟

class DataSyncService:
    """数据同步服务类"""
    
    def __init__(self):
        """初始化数据库和Redis连接"""
        self.engine = create_engine(f'mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}')
        self.Session = sessionmaker(bind=self.engine)
        self.redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)
        logger.info("数据同步服务初始化完成")
    
    def sync_redis_to_mysql(self):
        """将Redis中的排行榜数据同步到MySQL"""
        logger.info("开始从Redis同步数据到MySQL")
        session = self.Session()
        
        try:
            # 获取所有战区
            zones = session.query(Zone).all()
            
            for zone in zones:
                zone_id = zone.id
                leaderboard_key = f"zone:{zone_id}:leaderboard"
                
                # 检查Redis中是否有该战区的排行榜数据
                if self.redis_client.exists(leaderboard_key):
                    logger.info(f"同步战区 {zone_id} 的排行榜数据")
                    
                    # 获取排行榜数据
                    leaderboard_data = self.redis_client.zrange(
                        leaderboard_key, 0, -1, withscores=True
                    )
                    
                    # 更新MySQL中的用户分数
                    for user_id_bytes, score in leaderboard_data:
                        user_id = int(user_id_bytes)
                        user = session.query(User).filter_by(id=user_id).first()
                        
                        if user:
                            # 如果Redis中的分数与MySQL不同，则更新MySQL
                            if user.total_score != int(score):
                                logger.info(f"更新用户 {user_id} 的分数: {user.total_score} -> {int(score)}")
                                user.total_score = int(score)
                        else:
                            logger.warning(f"用户 {user_id} 在Redis中存在但在MySQL中不存在")
                    
                    # 提交更改
                    session.commit()
                    logger.info(f"战区 {zone_id} 的排行榜数据同步完成")
                else:
                    logger.info(f"战区 {zone_id} 在Redis中没有排行榜数据")
            
            logger.info("Redis到MySQL的数据同步完成")
        except Exception as e:
            session.rollback()
            logger.error(f"同步过程中发生错误: {str(e)}")
        finally:
            session.close()
    
    def sync_mysql_to_redis(self):
        """将MySQL中的用户分数同步到Redis"""
        logger.info("开始从MySQL同步数据到Redis")
        session = self.Session()
        
        try:
            # 获取所有战区
            zones = session.query(Zone).all()
            
            for zone in zones:
                zone_id = zone.id
                leaderboard_key = f"zone:{zone_id}:leaderboard"
                
                # 获取该战区的所有用户
                users = session.query(User).filter_by(current_zone_id=zone_id).all()
                
                if users:
                    logger.info(f"同步战区 {zone_id} 的用户数据到Redis")
                    
                    # 准备Redis数据
                    redis_data = {user.id: user.total_score for user in users}
                    
                    # 更新Redis排行榜
                    self.redis_client.zadd(leaderboard_key, redis_data)
                    logger.info(f"战区 {zone_id} 的用户数据同步到Redis完成")
                else:
                    logger.info(f"战区 {zone_id} 没有用户数据")
            
            logger.info("MySQL到Redis的数据同步完成")
        except Exception as e:
            logger.error(f"同步过程中发生错误: {str(e)}")
        finally:
            session.close()
    
    def run(self):
        """运行同步服务"""
        logger.info(f"数据同步服务启动，同步间隔: {SYNC_INTERVAL}秒")
        
        while True:
            try:
                # 从MySQL同步到Redis
                self.sync_mysql_to_redis()
                
                # 从Redis同步到MySQL
                self.sync_redis_to_mysql()
                
                logger.info(f"等待 {SYNC_INTERVAL} 秒后进行下一次同步")
                time.sleep(SYNC_INTERVAL)
            except KeyboardInterrupt:
                logger.info("收到中断信号，同步服务停止")
                break
            except Exception as e:
                logger.error(f"同步服务发生错误: {str(e)}")
                logger.info(f"等待 {SYNC_INTERVAL} 秒后重试")
                time.sleep(SYNC_INTERVAL)

if __name__ == "__main__":
    sync_service = DataSyncService()
    sync_service.run()