from sqlalchemy.orm import Session
from models import User
from typing import Optional, Dict, Any
from sqlalchemy.exc import SQLAlchemyError

def get_user_by_id(session: Session, user_id: int) -> Optional[User]:
    """
    根据用户ID查询用户信息
    
    参数:
        session: SQLAlchemy会话对象
        user_id: 要查询的用户ID
        
    返回:
        User对象(如果找到)或None(如果用户不存在)
    """
    try:
        # 使用session.query查询，可以添加.filter等链式调用
        user = session.query(User).filter(User.id == user_id).first()
        return user
    except Exception as e:
        # 记录错误日志(实际项目中应该使用logging模块)
        print(f"查询用户时发生错误: {e}")
        return None

def get_users_by_ids(
    session: Session, 
    user_ids: List[int],
    as_dict: bool = False
) -> Union[List[User], List[Dict[str, Any]]]:
    """
    根据用户ID列表批量查询用户信息
    
    参数:
        session: SQLAlchemy会话对象
        user_ids: 用户ID列表
        as_dict: 是否返回字典格式(默认为False，返回User对象)
        
    返回:
        用户对象列表或字典列表
    """
    if not user_ids:
        return []
    
    try:
        users = session.query(User).filter(User.id.in_(user_ids)).all()
        
        if as_dict:
            return [
                {
                    'id': user.id,
                    'nickname': user.nickname,
                    'avatar_url': user.avatar_url,
                    'current_zone_id': user.current_zone_id,
                    'total_score': user.total_score
                }
                for user in users
            ]
        return users
    except Exception as e:
        print(f"批量查询用户时发生错误: {e}")
        return []
    """
    根据用户ID查询用户信息
    
    参数:
        session: SQLAlchemy会话对象
        user_id: 要查询的用户ID
        
    返回:
        User对象(如果找到)或None(如果用户不存在)
    """
    try:
        # 使用session.query查询，可以添加.filter等链式调用
        user = session.query(User).filter(User.id == user_id).first()
        return user
    except Exception as e:
        # 记录错误日志(实际项目中应该使用logging模块)
        print(f"查询用户时发生错误: {e}")
        return None

def create_user(session: Session, user_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    创建新用户记录
    
    参数:
        session: SQLAlchemy会话对象
        user_data: 包含用户信息的字典，应有以下键:
            - nickname: 用户昵称(必需)
            - avatar_url: 头像URL(可选)
            - current_zone_id: 战区ID(可选，默认为0)
            - total_score: 总积分(可选，默认为0)
            
    返回:
        字典包含:
            - 'success': 操作是否成功
            - 'user': 新用户对象(成功时)
            - 'error': 错误信息(失败时)
    """
    if not user_data.get('nickname'):
        return {'success': False, 'error': '昵称不能为空'}
    
    try:
        new_user = User(
            nickname=user_data['nickname'],
            avatar_url=user_data.get('avatar_url'),
            current_zone_id=user_data.get('current_zone_id', 0),
            total_score=user_data.get('total_score', 0)
        )
        
        session.add(new_user)
        session.commit()
        session.refresh(new_user)
        
        return {
            'success': True,
            'user': new_user,
            'message': f'用户 {new_user.nickname} 创建成功，ID: {new_user.id}'
        }
        
    except SQLAlchemyError as e:
        session.rollback()
        return {
            'success': False,
            'error': f'数据库错误: {str(e)}'
        }

# 使用示例
if __name__ == "__main__":
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    
    # 创建数据库连接
    engine = create_engine('mysql+pymysql://user:password@localhost/game_leaderboard')
    Session = sessionmaker(bind=engine)
    db_session = Session()
    
    # 查询用户ID为1的信息
    user = get_user_by_id(db_session, 1)
    if user:
        print(f"找到用户: ID={user.id}, 昵称={user.nickname}")
    else:
        print("用户不存在")
    
    # 关闭会话
    db_session.close()