from data_fetcher import HonorOfKingsDataFetcher, DataImporter
from models import Base, Zone, User
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import redis

# 初始化数据库连接
engine = create_engine('mysql+pymysql://user:password@localhost/game_leaderboard')
Session = sessionmaker(bind=engine)
db_session = Session()

# 初始化Redis连接
redis_conn = redis.Redis(host='localhost', port=6379, db=0)

# 获取数据
print("获取排行榜数据...")
data = HonorOfKingsDataFetcher.get_rankings_data()
print(f"获取到 {len(data)} 条数据")

# 导入数据库
print("\n导入数据库...")
db_success = DataImporter.import_to_database(data, db_session)
print(f"数据库导入 {'成功' if db_success else '失败'}")

# 导入Redis
print("\n导入Redis...")
redis_success = DataImporter.import_to_redis(data, redis_conn)
print(f"Redis导入 {'成功' if redis_success else '失败'}")

# 验证数据
print("\n验证数据:")
print("MySQL用户数:", db_session.query(User).count())
print("Redis全局榜成员数:", redis_conn.zcard("global_leaderboard"))

db_session.close()