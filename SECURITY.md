# 安全说明

- **切勿**将 `.env`、`GITHUB_TOKEN`、数据库密码提交到仓库或写在 Issues / 聊天中。
- 若 Token 已泄露，请立即在 GitHub → Settings → Developer settings → Personal access tokens **撤销并重新生成**。
- 公网部署建议设置 `ENABLE_DEMO_API=false`，并配置 `FLASK_DEBUG=false`。
- 若配置 `API_KEY`，生产环境**不要**设置 `EXPOSE_CLIENT_API_KEY=true`（避免密钥出现在页面 HTML 中）。
- 速率限制优先使用 Redis；多 worker 部署时内存限流无效。
