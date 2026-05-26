# 安全说明

- **切勿**将 `.env`、`GITHUB_TOKEN`、数据库密码提交到仓库或写在 Issues / 聊天中。
- 若 Token 已泄露，请立即在 GitHub → Settings → Developer settings → Personal access tokens **撤销并重新生成**。
- 公网部署建议设置 `ENABLE_DEMO_API=false`，并配置 `FLASK_DEBUG=false`。
