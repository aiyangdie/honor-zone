from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, TIMESTAMP, Float
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()

class Zone(Base):
    """战区信息模型"""
    __tablename__ = 'zones'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False, unique=True, comment='战区名称')
    level = Column(Integer, default=1, comment='战区级别')
    created_at = Column(TIMESTAMP, server_default=func.now(), comment='创建时间')
    updated_at = Column(TIMESTAMP, server_default=func.now(), 
                       onupdate=func.now(), comment='更新时间')
    
    def __repr__(self):
        return f"<Zone(id={self.id}, name='{self.name}', level={self.level})>"

class User(Base):
    """用户信息模型"""
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    nickname = Column(String(50), nullable=False, comment='用户昵称')
    avatar_url = Column(String(255), nullable=True, comment='用户头像URL')
    current_zone_id = Column(Integer, ForeignKey('zones.id'), default=0, comment='当前战区ID')
    total_score = Column(Integer, default=0, comment='总积分')
    hero_level = Column(Integer, default=1, comment='英雄等级')
    win_rate = Column(Float, default=0.5, comment='胜率')
    created_at = Column(TIMESTAMP, server_default=func.now(), comment='创建时间')
    updated_at = Column(TIMESTAMP, server_default=func.now(), 
                       onupdate=func.now(), comment='更新时间')
    
    # 定义与Zone的关系
    zone = relationship("Zone", backref="users")

    def __repr__(self):
        return f"<User(id={self.id}, nickname='{self.nickname}')>"