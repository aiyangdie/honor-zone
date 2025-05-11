from models import engine
from sqlalchemy import text

def test_connection():
    try:
        with engine.connect() as conn:
            # 使用text()函数将字符串转换为可执行的SQL对象
            result = conn.execute(text("SELECT 1")).scalar()
            print('数据库连接测试:', '成功' if result == 1 else '失败')
    except Exception as e:
        print(f'数据库连接测试: 失败 - {e}')

if __name__ == "__main__":
    test_connection()