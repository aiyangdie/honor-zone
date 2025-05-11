# 王者荣耀战区排行榜系统

基于Redis + MySQL双引擎驱动的《王者荣耀》战区排行榜系统。

## 系统架构

排行榜系统采用分层架构，主要包括：
- 用户端
- 后端服务层（Flask API）
- 数据存储层（Redis和MySQL）

核心思想是将排行榜读写操作放在内存数据库Redis中，而将需要持久化、结构化存储的用户信息和历史数据放在关系型数据库MySQL中。

## 技术栈

- 后端：Python + Flask
- 数据库：MySQL + Redis
- ORM：SQLAlchemy

## 安装与配置

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置环境变量

复制`.env.example`文件为`.env`，并根据实际情况修改配置：

```bash
cp .env.example .env
# 编辑.env文件，修改数据库和Redis连接信息
```

### 3. 初始化数据库

```bash
mysql -u root -p < init_db.sql
```

### 4. 启动应用

```bash
# 启动所有服务(API服务和数据同步服务)
./run.sh
# 或
./run.sh all

# 只启动API服务
./run.sh api

# 只启动数据同步服务
./run.sh sync
```

数据同步服务负责在Redis和MySQL之间同步排行榜数据，确保数据一致性。默认同步间隔为5分钟，可通过.env文件中的SYNC_INTERVAL参数调整。

## API文档

### 用户管理

#### 创建用户
- **URL**: `/users`
- **方法**: `POST`
- **请求体**:
  ```json
  {
    "nickname": "玩家昵称",
    "avatar_url": "头像URL",
    "current_zone_id": 1,
    "total_score": 0
  }
  ```
- **响应**:
  ```json
  {
    "status": "success",
    "message": "用户创建成功",
    "data": {
      "id": 1,
      "nickname": "玩家昵称"
    }
  }
  ```

#### 获取用户信息
- **URL**: `/users/<user_id>`
- **方法**: `GET`
- **响应**:
  ```json
  {
    "status": "success",
    "data": {
      "id": 1,
      "nickname": "玩家昵称",
      "avatar_url": "头像URL",
      "current_zone_id": 1,
      "total_score": 100,
      "created_at": "2023-07-01T12:00:00"
    }
  }
  ```

### 战区管理

#### 创建战区
- **URL**: `/zones`
- **方法**: `POST`
- **请求体**:
  ```json
  {
    "name": "荣耀战区",
    "level": 1
  }
  ```
- **响应**:
  ```json
  {
    "status": "success",
    "message": "战区创建成功",
    "data": {
      "id": 1,
      "name": "荣耀战区",
      "level": 1
    }
  }
  ```

### 分数管理

#### 更新用户分数
- **URL**: `/scores/update`
- **方法**: `POST`
- **请求体**:
  ```json
  {
    "user_id": 1,
    "score": 50
  }
  ```
- **响应**:
  ```json
  {
    "status": "success",
    "message": "分数更新成功",
    "data": {
      "user_id": 1,
      "new_score": 150
    }
  }
  ```

### 排行榜

#### 获取战区排行榜
- **URL**: `/leaderboard/zone/<zone_id>?start=0&end=9`
- **方法**: `GET`
- **参数**:
  - `start`: 起始排名（默认0）
  - `end`: 结束排名（默认9）
- **响应**:
  ```json
  {
    "status": "success",
    "data": {
      "zone_id": 1,
      "leaderboard": [
        {
          "rank": 1,
          "user_id": 2,
          "nickname": "高分玩家",
          "avatar_url": "头像URL",
          "score": 500
        },
        {
          "rank": 2,
          "user_id": 1,
          "nickname": "玩家昵称",
          "avatar_url": "头像URL",
          "score": 150
        }
      ]
    }
  }
  ```

## 使用示例

### 1. 创建战区

```bash
curl -X POST http://localhost:5000/zones \
  -H "Content-Type: application/json" \
  -d '{"name": "荣耀战区", "level": 1}'
```

### 2. 创建用户

```bash
curl -X POST http://localhost:5000/users \
  -H "Content-Type: application/json" \
  -d '{"nickname": "玩家1", "current_zone_id": 1}'
```

### 3. 更新分数

```bash
curl -X POST http://localhost:5000/scores/update \
  -H "Content-Type: application/json" \
  -d '{"user_id": 1, "score": 100}'
```

### 4. 查询排行榜

```bash
curl http://localhost:5000/leaderboard/zone/1
```