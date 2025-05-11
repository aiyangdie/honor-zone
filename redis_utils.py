import redis
from typing import Optional, Dict, Any, List, Tuple
from typing import Union

class RedisRanking:
    def __init__(self, host='localhost', port=6379, db=0):
        """初始化Redis连接"""
        self.redis = redis.Redis(host=host, port=port, db=db, decode_responses=True)
    
    def increment_member_score(
        self, 
        key: str, 
        member: str, 
        increment: Union[int, float] = 1
    ) -> float:
        """
        原子性地增加Sorted Set成员的分数
        
        参数:
            key: Sorted Set的键名
            member: 成员标识
            increment: 要增加的分数(默认为1)
            
        返回:
            增加后的新分数
        """
        try:
            # ZINCRBY是原子操作
            new_score = self.redis.zincrby(key, increment, member)
            return float(new_score)
        except redis.RedisError as e:
            print(f"Redis操作失败: {e}")
            raise
    
    def bulk_increment_scores(
        self, 
        key: str, 
        member_scores: dict
    ) -> bool:
        """
        原子性地批量增加多个成员的分数
        
        参数:
            key: Sorted Set的键名
            member_scores: {成员: 增加分数}的字典
            
        返回:
            操作是否成功
        """
        try:
            # 使用pipeline确保原子性
            with self.redis.pipeline() as pipe:
                for member, increment in member_scores.items():
                    pipe.zincrby(key, increment, member)
                pipe.execute()
            return True
        except redis.RedisError as e:
            print(f"批量操作失败: {e}")
            return False

    def get_top_n(self, key: str, n: int = 10) -> List[Tuple[str, float]]:
        """
        获取Sorted Set中分数最高的N个成员
        
        参数:
            key: Sorted Set的键名
            n: 要获取的成员数量(默认为10)
            
        返回:
            包含(成员, 分数)的列表，按分数降序排列
        """
        try:
            # ZREVRANGE获取成员，WITHSCORES返回分数
            results = self.redis.zrevrange(key, 0, n-1, withscores=True)
            return [(member, float(score)) for member, score in results]
        except redis.RedisError as e:
            print(f"获取Top {n}失败: {e}")
            return []

    def get_member_rank_score(self, key: str, member: str) -> Dict[str, Optional[Union[int, float]]]:
        """
        查询成员在Sorted Set中的排名和分数
        
        参数:
            key: Sorted Set的键名
            member: 要查询的成员
            
        返回:
            包含排名和分数的字典:
            {
                'rank': 排名(从0开始，None表示不存在),
                'score': 分数(None表示不存在)
            }
        """
        try:
            # 使用pipeline减少网络往返
            with self.redis.pipeline() as pipe:
                pipe.zrevrank(key, member)  # 降序排名
                pipe.zscore(key, member)    # 分数
                rank, score = pipe.execute()
            
            return {
                'rank': int(rank) if rank is not None else None,
                'score': float(score) if score is not None else None
            }
        except redis.RedisError as e:
            print(f"查询成员排名失败: {e}")
            return {'rank': None, 'score': None}

    def get_paginated_leaderboard(
        self, 
        key: str, 
        page: int = 1, 
        page_size: int = 10
    ) -> Dict[str, Any]:
        """
        分页查询排行榜(整合Redis和MySQL数据)
        
        参数:
            key: Sorted Set的键名
            page: 页码(从1开始)
            page_size: 每页大小
            db_session: SQLAlchemy会话对象(可选)
            
        返回:
            {
                'total': 总成员数,
                'page': 当前页码,
                'page_size': 每页大小,
                'data': [{
                    'user_id': str,
                    'score': float,
                    'user_info': {
                        'nickname': str,
                        'avatar_url': str,
                        ...
                    } | None  # 如果未提供db_session或用户不存在
                }, ...]
            }
        """
        try: 
            # 参数验证
            page = max(1, page)
            page_size = max(1, min(page_size, 100))  # 限制最大100条/页
            
            # 计算分页偏移
            start = (page - 1) * page_size
            end = start + page_size - 1
            
            # 获取总成员数
            print("key = " + key)
            total = self.redis.zcard(key)
            print("again key = " + key)
        
            # 获取Redis排行榜数据
            redis_results = self.redis.zrevrange(key, start, end, withscores=True)
            
            # 基础数据格式
            data = [{
                'user_id': member.decode() if isinstance(member, bytes) else member,
                'score': float(score),
                'user_info': None
            } for member, score in redis_results]
            
            # 不再在Redis层处理数据库查询
            
            return {
                'total': total,
                'page': page,
                'page_size': page_size,
                'data': data
            }
        except redis.RedisError as e:
            print(f"Redis查询失败: {e}")
            return {
                'total': 0,
                'page': page,
                'page_size': page_size,
                'data': []
            }
        except Exception as e:
            print(f"数据整合失败: {e}")
            return {
                'total': 0,
                'page': page,
                'page_size': page_size,
                'data': []
            }

    def get_global_leaderboard(self, page: int = 1, page_size: int = 10) -> Dict[str, Any]:
        """
        查询全局排行榜分页数据
        """
        return self.get_paginated_leaderboard("global_leaderboard", page, page_size)

    def get_zone_leaderboard(self, zone_id: str, page: int = 1, page_size: int = 10) -> Dict[str, Any]:
        """
        查询战区排行榜分页数据
        """
        return self.get_paginated_leaderboard(f"zone_leaderboard:{zone_id}", page, page_size)

    def get_user_ranking(self, user_id: str, zone_id: Optional[str] = None) -> Dict[str, Any]:
        """
        查询用户在全局榜和/或战区榜的排名和分数
        
        参数:
            user_id: 用户ID
            zone_id: 可选战区ID
            
        返回:
            {
                'global': {'rank': 排名, 'score': 分数},
                'zone': {'rank': 排名, 'score': 分数}  # 如果提供了zone_id
            }
        """
        result = {
            'global': self.get_member_rank_score("global_leaderboard", user_id)
        }
        
        if zone_id:
            result['zone'] = self.get_member_rank_score(
                f"zone_leaderboard:{zone_id}", 
                user_id
            )
        
        return result

    def update_score(
        self,
        user_id: str, 
        zone_id: str,
        score_change: Union[int, float],
        max_queue_size: int = 10000
    ) -> bool:
        """
        更新全局和战区排行榜分数，并将用户ID添加到同步队列
        
        参数:
            user_id: 用户ID
            zone_id: 战区ID
            score_change: 分数变化值(可正可负)
            max_queue_size: 同步队列最大长度(可选)
        
        返回:
            操作是否成功
        """
        try:
            with self.redis.pipeline() as pipe:
                # 更新全局排行榜
                pipe.zincrby("global_leaderboard", score_change, user_id)
                # 更新战区排行榜
                pipe.zincrby(f"zone_leaderboard:{zone_id}", score_change, user_id)
                # 将用户ID添加到同步队列末尾
                pipe.rpush("sync_queue", user_id)
                # 可选: 限制队列长度
                if max_queue_size > 0:
                    pipe.ltrim("sync_queue", -max_queue_size, -1)
                pipe.execute()
            return True
        except redis.RedisError as e:
            print(f"更新排行榜失败: {e}")
            return False

# 使用示例
if __name__ == "__main__":
    ranking = RedisRanking()
    
    # 单个成员原子增加
    new_score = ranking.increment_member_score("leaderboard", "user123", 10)
    print(f"user123的新分数: {new_score}")
    
    # 批量原子增加
    updates = {"user456": 5, "user789": 3}
    success = ranking.bulk_increment_scores("leaderboard", updates)
    print(f"批量更新{'成功' if success else '失败'}")