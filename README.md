# BoltShell - AI SSH Tool

一款基于浏览器的跨平台 AI SSH 工具，用户可以通过自然语言与 AI 交互，AI 返回命令并解释，用户确认后执行。

## ✨ 特性

- 🤖 **AI 自然语言转命令** — 用中文描述需求，AI 生成可执行命令
- 📜 **命令历史追踪** — 记录所有 AI 建议命令，显示执行状态（待执行/已执行/已取消）
- 🔄 **智能反馈循环** — 命令执行后 AI 自动分析输出，给出后续建议
- 💡 **实时命令提示** — 输入命令时 AI 实时提供补全建议（类似 IDE 自动补全）
- ⚠️ **危险命令检测** — 自动识别 `rm -rf`、`dd`、`mkfs` 等危险操作并警告
- 📁 **文件管理器** — 可视化 SFTP 文件操作，支持上传、下载、打包
- 🖥️ **多会话管理** — Tab 多标签页，同时连接多台服务器
- 🔐 **本地加密存储** — 密码、密钥、API Key 使用 AES-256-GCM 加密
- ⌨️ **快捷键支持** — Tab 接受提示，↑↓ 导航，Esc 关闭面板

## 🆕 新功能：AI 智能命令交互

### 命令历史与状态追踪
执行 AI 建议的命令后，系统会记录命令历史：
- 显示"已执行"状态标签
- 保留历史记录列表（最近 50 条）
- 可查看每条命令的执行输出

### 命令执行反馈循环
命令执行完成后：
- AI 自动分析命令输出
- 判断命令是否成功执行
- 如果需要后续操作，给出建议命令

### 实时命令提示
输入命令时（英文输入超过 2 个字符）：
- AI 实时提供命令补全建议
- 显示命令说明
- 支持键盘导航（↑↓ 选择，Tab 接受）

## 🛠️ 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 18 + TypeScript + xterm.js + Ant Design |
| 后端 | Java 17 + Spring Boot 3.x + SSHJ |
| 通信 | WebSocket (终端) + REST API (配置) |
| AI | OpenAI 兼容 API (支持 OpenAI/通义千问/DeepSeek 等) |

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

## 📖 使用指南

### AI 配置
1. 点击右上角设置图标
2. 配置 AI API（支持 OpenAI 兼容接口）
3. 设置 Base URL、API Key 和模型名称

### 命令交互
1. 在终端中输入中文问题，如"查看当前目录下最大的10个文件"
2. AI 会生成命令并显示在右侧面板
3. 查看命令说明和风险等级
4. 点击"执行"或修改后执行
5. 命令执行后可查看历史记录和 AI 后续建议

### 命令提示
1. 在终端中输入英文命令（如 `sudo apt`）
2. 等待 300ms 后会显示命令提示列表
3. 使用 ↑↓ 键选择，Tab 键接受

## 📖 文档

- [架构决策记录](docs/adr/ADR-001-ssh-web-architecture.md)
- [API 契约](api/openapi/v1/api-spec.md)
- [配置规范](docs/spec/config-spec.md)
- [更新日志](docs/CHANGELOG.md)

## 📝 License

MIT