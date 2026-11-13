<p align="center"><img src="assets/covers/41-honor-zone.jpg" alt="荣耀战区 项目封面" width="100%"></p>

<h1 align="center">荣耀战区 · Honor Zone Web</h1>

<p align="center">王者荣耀战力查询 + 战区排行榜演示，Flask 单体应用</p>

<p align="center">
  <a href="LICENSE">MIT 许可</a>
</p>

## 简介

冲标前想先看看省标、市标、区标的大致战力线，这个页面能一次查完：单英雄查四个大区（安卓 / 苹果 × QQ / 微信），也能对比四区最低区标。另带一个本地战区排行榜，用来演示排行、用户与积分玩法。

## 功能

**战力查询（第三方数据）**

- 单英雄查询国标 / 省标 / 市标 / 区标
- 四区对比：安卓·苹果 × QQ·微信
- 热门英雄快捷入口、全英雄名称联想
- 主备数据源自动切换（`sapi.run` ↔ `xxoo.team`）

**战区排行（本地演示）**

- 战区下拉、排行榜（排名 / 头像 / 昵称 / 积分）
- 新建自定义战区、一键导入演示数据
- 用户中心：创建演示用户、更新积分、按 ID 查资料

## 技术栈

Python 3.10+ · Flask 2.3 ｜ MySQL 8.0（战区与用户）｜ Redis（排行排序）｜ 深色 + 金主题前端

## 快速开始

```powershell
git clone https://github.com/aiyangdie/honor-zone.git
cd honor-zone
pip install -r requirements.txt
copy .env.example .env
python _init_local.py      # 首次初始化数据库
```

```powershell
# 终端 1
redis-server
# 终端 2
.\start.ps1
```

| 访问方式 | 地址 |
|---|---|
| 电脑 | http://127.0.0.1:5000 |
| 手机（同一 WiFi） | 页脚显示的 `http://192.168.x.x:5000` |

配置项在 `.env`：`FLASK_DEBUG`（公网部署务必 `false`）、`FLASK_PORT`、`ENABLE_DEMO_API`、`DB_*`、`REDIS_*`、`HERO_API_*`。

## 接口

启动后访问 `http://127.0.0.1:5000/api` 查看接口页。

| 接口 | 说明 |
|---|---|
| `GET /api/health` | 服务与依赖健康、局域网地址 |
| `GET /api/heroes` | 英雄列表 |
| `GET /api/hero/power?hero=李白&type=aqq` | 单区战力 |
| `GET /api/hero/power/all?hero=李白` | 四区对比 |
| `GET/POST /api/zones` | 战区 |
| `GET /api/leaderboard/zone/<id>` | 榜单 |
| `POST /api/users` / `GET /api/users/<id>` | 用户 |
| `POST /api/scores/update` | 更新积分 |
| `POST /api/seed` | 导入演示（需 `ENABLE_DEMO_API`） |

## 项目结构

```
app.py         Flask 入口        hero_api.py   战力接口
database.py    MySQL 与战区      health.py     健康检查、局域网 IP
models.py      ORM              templates/    页面
static/        样式与脚本        docs/DEPLOY.md 在线部署说明
init_db.sql / _init_local.py / start.ps1 / render.yaml
```

## 部署

Pages 托管不了 Python 后端，需要部署到 Render / Railway 这类平台，步骤见 [docs/DEPLOY.md](docs/DEPLOY.md)（含 MySQL、Redis 与 `render.yaml` 用法）。

## 数据说明

| 数据 | 来源 | 说明 |
|---|---|---|
| 战力 | 第三方公开接口 | 非腾讯官方实时数据，通常每周更新，仅供冲标参考 |
| 英雄列表 | 腾讯官方 JSON + 第三方补全 | |
| 排行榜 | 本地 MySQL + Redis | 演示数据，可自建用户 |

不能用于游戏内改战区，也不能代替官方排行榜。

## 免责声明

与腾讯《王者荣耀》无关联。数据仅供参考，请遵守游戏用户协议，勿用于违规改区、代练等行为；使用第三方接口时请自行评估合规风险。

## 许可证

[MIT](LICENSE)
