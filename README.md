# 荣耀战区 · Honor Zone Web

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.3-green)](https://flask.palletsprojects.com/)
[![License](https://img.shields.io/badge/License-MIT-lightgrey)](LICENSE)

王者荣耀 **战力查询** + **战区排行榜演示** 一体化 Web 工具。  
支持电脑与手机浏览器，适合冲标时查询省市区标战力参考，以及本地演示排行榜玩法。

**作者 GitHub：** [@aiyangdie](https://github.com/aiyangdie)

---

## 在线体验

| 方式 | 说明 |
|------|------|
| **公网部署** | 按 [docs/DEPLOY.md](docs/DEPLOY.md) 部署到 [Render](https://render.com) / [Railway](https://railway.app) 后获得 HTTPS 地址 |
| **本地运行** | 见下方「快速开始」 |
| **GitHub Pages** | ❌ 不支持（需 Python 后端，见部署文档） |

部署完成后，手机请使用 **https 公网链接**，不要使用 `127.0.0.1`。

---

## 功能一览

### 战力查询（第三方数据）

- 单英雄查询：国标 / 省标 / 市标 / 区标
- 四区对比：安卓·苹果 × QQ·微信
- 热门英雄快捷查询、全英雄名称联想
- 主备数据源自动切换（sapi.run ↔ xxoo.team）

### 战区排行（本地演示）

- 战区下拉、排行榜（排名 / 头像 / 昵称 / 积分）
- 新建自定义战区
- 一键导入演示数据（MySQL + Redis）
- **非游戏官方榜**，仅供演示

### 用户中心

- 创建演示用户、更新积分、按 ID 查询资料

---

## 界面预览

- 深色 + 金色主题，三 Tab：战力查询 / 战区排行 / 用户中心
- 页脚显示：**手机局域网访问地址**（本地运行时）
- 依赖异常时顶部告警条提示

---

## 快速开始（Windows）

### 环境要求

- Python 3.10+
- MySQL 8.0+（排行榜与用户）
- Redis（排行榜排序）

### 安装

```powershell
git clone https://github.com/aiyangdie/honor-zone.git
cd honor-zone
pip install -r requirements.txt
copy .env.example .env
```

### 初始化数据库（首次）

```powershell
python _init_local.py
```

### 启动

```powershell
# 终端 1：Redis
redis-server

# 终端 2：Web
.\start.ps1
# 或 python app.py
```

| 访问方式 | 地址 |
|----------|------|
| 电脑 | http://127.0.0.1:5000 |
| 手机（同一 WiFi） | 页脚显示的 `http://192.168.x.x:5000` |

启动时控制台会打印 MySQL / Redis / 手机访问地址。

---

## 配置说明

复制 `.env.example` 为 `.env`：

| 变量 | 说明 |
|------|------|
| `FLASK_DEBUG` | 本地可 `true`；公网部署务必 `false` |
| `FLASK_PORT` | 默认 `5000` |
| `ENABLE_DEMO_API` | `false` 时关闭「新建战区」「导入演示」 |
| `DB_*` | MySQL |
| `REDIS_*` | Redis |
| `HERO_API_*` | 战力接口，见 `.env.example` |

---

## API 文档

启动后访问：**http://127.0.0.1:5000/api**

| 接口 | 说明 |
|------|------|
| `GET /api/health` | 服务与依赖健康、局域网地址 |
| `GET /api/heroes` | 英雄列表 |
| `GET /api/platforms` | 登录大区 |
| `GET /api/hero/power?hero=李白&type=aqq` | 单区战力 |
| `GET /api/hero/power/all?hero=李白` | 四区对比 |
| `GET /api/hero/status` | 状态汇总 |
| `GET/POST /api/zones` | 战区 |
| `GET /api/leaderboard/zone/<id>` | 排行榜 |
| `POST /api/users` | 创建用户 |
| `GET /api/users/<id>` | 查询用户 |
| `POST /api/scores/update` | 更新积分 |
| `POST /api/seed` | 导入演示（需 `ENABLE_DEMO_API`） |

---

## 项目结构

```
honor-zone/
├── app.py              # Flask 入口
├── hero_api.py         # 战力第三方接口
├── database.py         # MySQL、战区修复
├── health.py           # 健康检查、局域网 IP
├── models.py           # ORM
├── templates/          # 页面
├── static/             # CSS / JS / 图标
├── docs/DEPLOY.md      # 在线部署详细说明
├── render.yaml         # Render 蓝图
├── Procfile            # gunicorn 启动
├── init_db.sql         # 建表
├── _init_local.py      # 本地 MySQL 初始化
└── start.ps1           # Windows 启动脚本
```

---

## 在线部署

详细步骤（Render / Railway、MySQL / Redis 配置）：  
👉 **[docs/DEPLOY.md](docs/DEPLOY.md)**

简要流程：

1. Fork / 使用本仓库
2. 准备 MySQL + Redis（可用云免费套餐）
3. Render 连接 GitHub → 使用 `render.yaml` 或手动配置环境变量
4. 部署后访问 `https://xxx.onrender.com`

---

## 数据说明

| 数据 | 来源 | 说明 |
|------|------|------|
| 战力 | 第三方公开接口 | 非腾讯官方实时，通常每周更新，仅供冲标参考 |
| 英雄列表 | 腾讯官方 JSON + 第三方补全 | |
| 排行榜 | 本地 MySQL + Redis | 演示数据，可自建用户 |

**不能**用于游戏内改战区、不能代替官方排行榜。

---

## 免责声明

本工具与腾讯《王者荣耀》无关联。数据仅供参考，请遵守游戏用户协议，勿用于违规改区、代练等行为。使用第三方接口时请自行评估合规风险。

---

## 开源协议

MIT License — 见 [LICENSE](LICENSE)（若仓库无 LICENSE 文件可自行添加 MIT 协议）。

---

## 联系

- GitHub：[@aiyangdie](https://github.com/aiyangdie)
