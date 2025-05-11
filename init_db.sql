-- 创建游戏排行榜数据库
CREATE DATABASE IF NOT EXISTS game_leaderboard DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE game_leaderboard;

-- 创建战区信息表
CREATE TABLE IF NOT EXISTS zones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL COMMENT '战区名称',
    level INT DEFAULT 1 COMMENT '战区级别',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='战区信息表';

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nickname VARCHAR(50) NOT NULL COMMENT '用户昵称',
    avatar_url VARCHAR(255) COMMENT '用户头像URL',
    current_zone_id INT DEFAULT 0 COMMENT '当前战区ID',
    CONSTRAINT fk_user_zone FOREIGN KEY (current_zone_id) REFERENCES zones(id),
    total_score INT DEFAULT 0 COMMENT '总积分',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户信息表';

-- 在current_zone_id字段上创建索引
CREATE INDEX idx_user_zone ON users(current_zone_id);