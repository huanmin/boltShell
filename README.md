# BoltShell - AI SSH Tool

一款基于浏览器的跨平台 AI SSH 工具，用户可以通过自然语言与 AI 交互，AI 返回命令并解释，用户确认后执行。

## ✨ 特性

- 🤖 **AI 自然语言转命令** — 用中文描述需求，AI 生成可执行命令
- 🔄 **Shell/Agent 模式切换** — Shell 模式专注命令执行，Agent 模式支持自然语言交互
- 💡 **AI 命令助手** — Shell 模式下可通过快捷键唤出 AI 命令建议面板
- 📜 **命令历史追踪** — 记录所有 AI 建议命令，显示执行状态（待执行/已执行/已取消）
- 🔄 **智能反馈循环** — 命令执行后 AI 自动分析输出，给出后续建议
- ⌨️ **Tab 命令补全** — 按 Tab 键请求 AI 命令补全建议
- ⚠️ **危险命令检测** — 自动识别 `rm -rf`、`dd`、`mkfs` 等危险操作并警告
- 📁 **文件管理器** — 可视化 SFTP 文件操作，支持上传、下载、打包
- 🖥️ **多会话管理** — Tab 多标签页，同时连接多台服务器
- 🔐 **本地加密存储** — 密码、密钥、API Key 使用 AES-256-GCM 加密
- 🎨 **自定义终端** — 完全自定义的终端实现，支持 ANSI 颜色解析

## 🆕 新功能：AI 智能命令交互

### Shell/Agent 模式切换

在终端标签页右侧可切换模式：
- **Shell 模式**：传统终端体验，支持 Ctrl+Shift+Y 唤出 AI 命令助手
- **Agent 模式**：AI 增强模式，支持自然语言输入，AI 智能响应

### AI 命令助手（Shell 模式）

- 按 `Ctrl+Shift+Y` 唤出可拖动的 AI 命令建议面板
- 输入中文描述，AI 生成命令
- 支持复制命令、插入到终端

### Agent 模式 AI 交互

在 Agent 模式下：
1. 输入中文描述，AI 生成命令
2. 显示风险等级（安全/中等/高危/极高危）
3. 三种操作：执行、修改、拒绝
4. 命令执行后 AI 给出后续建议

### 命令历史与状态追踪

执行 AI 建议的命令后，系统会记录命令历史：
- 显示"已执行"状态标签
- 保留历史记录列表
- 可查看每条命令的执行输出

### Tab 命令补全

输入命令时按 Tab 键：
- AI 提供命令补全建议
- 显示命令说明
- 支持键盘导航（↑↓ 选择，Tab/Enter 接受，Esc 关闭）

## 🛠️ 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 18 + TypeScript + 自定义终端 + Ant Design |
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

### Shell 模式使用
1. 默认为 Shell 模式，可直接输入命令执行
2. 按 `Ctrl+Shift+Y` 唤出 AI 命令助手
3. 输入中文描述获取命令建议
4. 按 Tab 键获取命令补全

### Agent 模式使用
1. 切换到 Agent 模式
2. 输入中文问题，如"查看当前目录下最大的10个文件"
3. AI 生成命令并显示风险等级
4. 选择执行、修改或拒绝
5. 命令执行后可查看 AI 后续建议

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+I` | 切换 Shell/Agent 模式 |
| `Ctrl+Shift+Y` | 唤出 AI 命令助手（Shell 模式） |
| `Tab` | 请求命令补全 |
| `↑/↓` | 选择提示项/命令历史 |
| `Enter` | 执行命令/接受提示 |
| `Esc` | 关闭提示列表 |
| `Ctrl+C` | 清空当前输入 |

## 📖 文档

- [架构决策记录](docs/adr/ADR-001-ssh-web-architecture.md)
- [API 契约](api/openapi/v1/api-spec.md)
- [配置规范](docs/spec/config-spec.md)
- [AI 交互需求](docs/AI_INTERACTION_REQUIREMENTS.md)
- [更新日志](docs/CHANGELOG.md)

## 📝 License

MIT