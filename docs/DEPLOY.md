# 部署指南 · 荣耀战区 Web

本项目是 **Flask + MySQL + Redis** 全栈应用，**不能**用 GitHub Pages 托管（Pages 仅支持静态网页）。  
在线使用请部署到 **Render**、**Railway** 等支持 Python 的平台。

---

## 一、部署架构

```
浏览器 → HTTPS → Render/Railway (gunicorn + Flask)
                      ├── MySQL（用户/战区/排行榜）
                      ├── Redis（排行榜排序）
                      └── 第三方战力 API（sapi / xxoo）
```

| 组件 | 是否必须 | 说明 |
|------|----------|------|
| Web (Flask) | 是 | `gunicorn app:app` |
| MySQL | 排行榜/用户必须 | 战力查询可不依赖 |
| Redis | 排行榜必须 | 战力查询可不依赖 |
| 第三方战力 API | 战力功能必须 | 公网可访问即可 |

---

## 二、Render 部署（推荐免费试用）

### 1. 准备 GitHub 仓库

代码已在：`https://github.com/aiyangdie/honor-zone`（推送后可用）

### 2. 创建 MySQL

任选其一：

- [PlanetScale](https://planetscale.com/) 免费 MySQL（兼容 MySQL 协议）
- [Railway](https://railway.app/) 添加 MySQL 插件
- 自有云服务器 MySQL 8.0+

执行建表脚本 `init_db.sql`，或首次启动后访问站点触发 `Base.metadata.create_all`。

### 3. 创建 Redis

- [Upstash](https://upstash.com/) 免费 Redis
- Railway Redis 插件
- Render 若提供 Redis 附加组件可绑定

### 4. 在 Render 创建 Web Service

1. 登录 [Render](https://render.com/)
2. **New → Blueprint** 或 **Web Service**
3. 连接 GitHub 仓库 `aiyangdie/honor-zone`
4. 若用 Blueprint：选择仓库内 `render.yaml`
5. 在 **Environment** 添加变量（参考 `.env.example`）：

```env
DB_HOST=你的mysql主机
DB_USER=...
DB_PASSWORD=...
DB_NAME=game_leaderboard

REDIS_HOST=...
REDIS_PORT=6379
REDIS_DB=0

FLASK_DEBUG=false
ENABLE_DEMO_API=true
HERO_API_PRIMARY=sapi
HERO_API_FALLBACK=xxoo
HERO_USE_OFFICIAL_LIST=true
```

6. 部署完成后访问：`https://你的服务名.onrender.com`

> 免费实例冷启动约 30–60 秒，首次打开请耐心等待。

---

## 三、Railway 部署（备选）

1. [Railway](https://railway.app/) → New Project → Deploy from GitHub
2. 选择本仓库
3. 添加 **MySQL**、**Redis** 服务，将连接信息写入 Web 服务环境变量
4. **Start Command**：

```bash
gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120
```

5. 生成公网域名后即可访问

---

## 四、本地 Windows 运行

```powershell
cd LongTengFly-Python
pip install -r requirements.txt
copy .env.example .env
python _init_local.py    # 首次：初始化 MySQL
redis-server             # 另开窗口
.\start.ps1              # 或 python app.py
```

- 电脑：http://127.0.0.1:5000  
- 手机（同一 WiFi）：见页脚 **手机访问** 链接

---

## 五、环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `DB_*` | 排行榜/用户 | MySQL 连接 |
| `REDIS_*` | 排行榜 | Redis 连接 |
| `FLASK_DEBUG` | 否 | 生产务必 `false` |
| `ENABLE_DEMO_API` | 否 | `false` 关闭新建战区/导入演示 |
| `HERO_API_*` | 战力 | 第三方接口，见 `.env.example` |

---

## 六、健康检查

部署后访问：

```
GET https://你的域名/api/health
```

返回 `mysql`、`redis`、`hero_api`、`lan_url` 等状态。

---

## 七、常见问题

**Q：GitHub Pages 打开是 404？**  
A：Pages 不能跑 Python 后端，请用 Render/Railway 地址。

**Q：排行榜空白？**  
A：检查 MySQL、Redis 环境变量；可点击「导入演示数据」。

**Q：战力查询失败？**  
A：检查服务器能否访问外网（sapi.run / xxoo.team）。

**Q：手机打不开？**  
A：不要用 `127.0.0.1`，用部署后的 **https 公网域名**。

---

## 八、安全建议

- 勿将 `.env`、数据库密码、GitHub Token 提交到仓库
- 公网部署建议 `ENABLE_DEMO_API=false`，避免他人随意导入数据
- 本工具与腾讯无关，战力与排行榜均为第三方/演示数据
