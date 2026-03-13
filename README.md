# BoltShell - AI SSH Tool

一款基于浏览器的跨平台 AI SSH 工具，用户可以通过自然语言与 AI 交互，AI 返回命令并解释，用户确认后执行。

## ✨ 特性

- 🤖 **AI 自然语言转命令** — 用中文描述需求，AI 生成可执行命令
- ⚠️ **危险命令检测** — 自动识别 `rm -rf`、`dd`、`mkfs` 等危险操作并警告
- 📁 **文件管理器** — 可视化 SFTP 文件操作，支持上传、下载、打包
- 🖥️ **多会话管理** — Tab 多标签页，同时连接多台服务器
- 🔐 **本地加密存储** — 密码、密钥、API Key 使用 AES-256-GCM 加密

## 🛠️ 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 18 + TypeScript + xterm.js + Ant Design |
| 后端 | Java 17 + Spring Boot 3.x + SSHJ |
| 通信 | WebSocket (终端) + REST API (配置) |
| AI | Spring AI (OpenAI/通义千问) |

## 🚀 快速开始

### 后端

```bash
cd backend
mvn spring-boot:run
```

后端服务运行在 http://localhost:18080

### 前端

```bash
cd frontend
npm install
npm run dev
```

前端服务运行在 http://localhost:5173

## 📖 文档

- [架构决策记录](docs/adr/ADR-001-ssh-web-architecture.md)
- [API 契约](api/openapi/v1/api-spec.md)
- [配置规范](docs/spec/config-spec.md)

## 📝 License

MIT