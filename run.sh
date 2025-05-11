#!/bin/bash

# 安装依赖
echo "正在安装依赖..."
pip install -r requirements.txt

# 检查MySQL服务是否运行
echo "检查MySQL服务..."
if ! command -v mysql &> /dev/null; then
    echo "警告: MySQL客户端未安装，无法检查服务状态"
else
    if ! mysql -e "SELECT 1" &> /dev/null; then
        echo "警告: 无法连接到MySQL服务，请确保MySQL服务已启动"
        echo "您可能需要运行: sudo service mysql start"
    else
        echo "MySQL服务正常运行"
    fi
fi

# 检查Redis服务是否运行
echo "检查Redis服务..."
if ! command -v redis-cli &> /dev/null; then
    echo "警告: Redis客户端未安装，无法检查服务状态"
else
    if ! redis-cli ping &> /dev/null; then
        echo "警告: 无法连接到Redis服务，请确保Redis服务已启动"
        echo "您可能需要运行: sudo service redis-server start"
    else
        echo "Redis服务正常运行"
    fi
fi

# 加载环境变量(如果.env文件存在)
if [ -f .env ]; then
    echo "加载.env文件中的环境变量..."
    export $(grep -v '^#' .env | xargs)
fi

# 解析命令行参数
SERVICE="all"
if [ $# -gt 0 ]; then
    SERVICE=$1
fi

# 根据参数启动不同的服务
case $SERVICE in
    "api")
        echo "启动王者荣耀战区排行榜API服务..."
        python app.py
        ;;
    "sync")
        echo "启动数据同步服务..."
        python sync_service.py
        ;;
    "all")
        echo "启动所有服务..."
        echo "启动数据同步服务(后台运行)..."
        python sync_service.py > sync_service.log 2>&1 &
        SYNC_PID=$!
        echo "数据同步服务PID: $SYNC_PID"
        echo "启动王者荣耀战区排行榜API服务..."
        python app.py
        ;;
    *)
        echo "未知的服务类型: $SERVICE"
        echo "可用选项: api, sync, all(默认)"
        exit 1
        ;;
esac