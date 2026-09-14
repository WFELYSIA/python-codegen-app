# Python 代码生成 Web 应用

一个本地运行的多轮对话代码生成工具。它通过你配置的 OpenAI 兼容 API 生成和修改 Python 代码，支持流式输出、代码复制和下载，但不会执行生成的代码。

> 学生王君宇作品

## 启动

```powershell
cd D:\codex\2026-09-14\b\outputs\python-codegen-app
npm install
npm run build
npm start
```

打开 <http://localhost:3001>，首次进入会弹出 API 设置，填写：

- API 地址：OpenAI 兼容接口的 base URL，例如 `https://api.example.com/v1`
- API Key：仅在本地服务端保存
- 模型名称：由你的接口提供

开发模式：

```powershell
npm run dev
```

前端开发地址为 <http://localhost:5173>，API 服务运行在 `http://localhost:3001`。

## 测试

```powershell
npm test
npm run typecheck
```

## 说明

- 对话历史保存在浏览器 `localStorage`，刷新页面后仍会保留。
- API 地址和密钥保存在 `server/data/config.json`，该文件已被 `.gitignore` 忽略。
- 生成内容只用于展示、复制和下载，应用不提供代码执行功能。
