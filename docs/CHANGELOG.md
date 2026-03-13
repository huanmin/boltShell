# AI SSH Tool - 开发进度日志

## 2026-03-12 开发记录

### ✅ 已完成功能

#### Phase 1: 后端骨架 (100%)

| 模块 | 功能 | 状态 |
|------|------|------|
| **项目结构** | Spring Boot 3.2.5 + Java 17 | ✅ |
| **配置管理** | ConfigService 读取 ~/.ai-ssh-tool/config.json | ✅ |
| **凭证加密** | AES-256-GCM 加密，随机密钥存储 | ✅ |
| **REST API** | 连接管理 CRUD | ✅ |
| **REST API** | AI 配置 CRUD | ✅ |
| **REST API** | 健康检查 /api/v1/health | ✅ |
| **WebSocket** | SSH 终端会话处理 | ✅ |
| **测试覆盖** | 42 个测试用例全部通过 | ✅ |

#### Phase 2: SSH 核心 (80%)

| 模块 | 功能 | 状态 |
|------|------|------|
| **SSHJ 集成** | SSH 连接、Shell 会话 | ✅ |
| **命令执行** | 同步命令执行 | ✅ |
| **危险命令检测** | DangerCommandChecker | ✅ |
| **主机密钥验证** | 支持 known_hosts | ✅ |
| **SFTP 文件传输** | 上传、下载 | ❌ 待开发 |

#### 前端实现 (90%)

| 模块 | 功能 | 状态 |
|------|------|------|
| **项目搭建** | Vite + React 18 + TypeScript | ✅ |
| **UI 组件** | Ant Design 5.x | ✅ |
| **终端模拟** | xterm.js 集成 | ✅ |
| **状态管理** | Zustand | ✅ |
| **连接管理 UI** | 列表、新增、编辑、删除 | ✅ |
| **测试连接** | 创建前测试 SSH 连接 | ✅ |
| **保存密码选项** | 可选择是否保存密码 | ✅ |
| **AI 命令卡片** | 中文输入触发 AI 建议 | ✅ |
| **命令修改** | 可修改 AI 建议的命令 | ✅ |
| **危险命令警告** | 红色警告样式 | ✅ |
| **Tab 补全** | 在终端中支持 Tab 键补全 | ✅ |

---

### 🔧 技术实现细节

#### 后端架构

```
backend/
├── src/main/java/com/aisshtool/
│   ├── AisshToolApplication.java      # 启动类
│   ├── config/
│   │   ├── CorsConfig.java            # CORS 跨域配置
│   │   └── WebSocketConfig.java       # WebSocket 配置
│   ├── controller/
│   │   ├── ConnectionController.java  # 连接管理 API
│   │   ├── AiConfigController.java    # AI 配置 API
│   │   └── HealthController.java      # 健康检查
│   ├── model/
│   │   ├── Connection.java            # 连接模型
│   │   ├── AiConfig.java              # AI 配置模型
│   │   ├── ApiResult.java             # 统一响应格式
│   │   └── ErrorCode.java             # 错误码定义
│   ├── service/
│   │   ├── ConfigService.java         # 配置服务
│   │   └── CredentialService.java     # 凭证服务
│   ├── security/
│   │   ├── EncryptionService.java     # 加密服务
│   │   └── DangerCommandChecker.java  # 危险命令检测
│   ├── ssh/
│   │   └── SshClient.java             # SSH 客户端封装
│   ├── websocket/
│   │   └── SshWebSocketHandler.java   # WebSocket 处理器
│   └── exception/
│       └── GlobalExceptionHandler.java
└── src/test/                          # 测试代码
```

#### 前端架构

```
frontend/
├── src/
│   ├── api/
│   │   └── index.ts                   # API 调用封装
│   ├── components/
│   │   ├── Layout/
│   │   │   └── index.tsx              # 主布局
│   │   ├── Sidebar/
│   │   │   └── index.tsx              # 侧边栏（连接列表）
│   │   ├── Terminal/
│   │   │   ├── TerminalArea.tsx       # 终端区域
│   │   │   ├── AiCommandCard.tsx      # AI 命令卡片
│   │   │   └── index.css
│   │   └── Connection/
│   │       └── ConnectionModal.tsx    # 连接弹窗（新增/编辑）
│   └── stores/
│       └── appStore.ts                # Zustand 状态管理
```

---

### 🎯 交互设计变更

#### 原设计：底部输入框
```
┌─────────────────────────────┐
│ 终端输出                     │
├─────────────────────────────┤
│ $ [输入框]                  │  ← 底部输入框
└─────────────────────────────┘
```

#### 新设计：终端内输入
```
┌─────────────────────────────┐
│ 终端输出                     │
│ root@server:~$ 查看最大文件  │  ← 直接在终端输入
│                             │
│ ┌─────────────────────────┐ │
│ │ 💡 AI 建议   [修改][执行]│ │  ← AI 卡片浮层
│ │ $ du -ah . | sort...    │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

**变更原因**：
1. Tab 补全在真正的终端中才能工作
2. 用户习惯在终端中输入命令
3. 交互更自然，减少 UI 层级

**实现方式**：
- 输入时追踪当前行内容
- 中文输入：本地显示，回车时发送 AI 请求
- 英文输入：实时发送到 SSH 终端
- Tab 键：直接发送到 SSH 终端补全

---

### 🐛 问题修复记录

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| CORS 跨域失败 | 后端未配置 CORS | 添加 CorsConfig.java |
| 密码字段无法接收 | @JsonIgnore 阻止反序列化 | 改用 @JsonProperty(WRITE_ONLY) |
| 测试连接密码为空 | rememberCredential=false 时清空密码 | 新增 /test 端点直接测试 |
| WebSocket 连接失败 | 加密密码未解密 | SshClient 中添加解密逻辑 |
| Tab 键无法补全 | 底部输入框不是真正终端 | 移除输入框，改为终端内输入 |
| 中文被当命令执行 | state 更新异步 | 改用 useRef 追踪输入 |
| 中文不显示 | 阻止发送到终端 | 中文用 xterm.write 本地显示 |

---

### 📋 待开发功能

#### Phase 3: AI 集成 (0%)
- [ ] Spring AI 集成
- [ ] OpenAI/通义千问 API 调用
- [ ] AI 提示词优化

#### Phase 4: 文件传输 (0%)
- [ ] SFTP 上传/下载
- [ ] 文件列表展示
- [ ] 拖拽上传

#### Phase 5: 优化 (0%)
- [ ] 终端输出性能优化
- [ ] 连接池管理
- [ ] 系统密钥链集成

---

### 🚀 部署信息

| 环境 | 地址 | 状态 |
|------|------|------|
| 后端 API | http://localhost:18080 | ✅ 运行中 |
| 前端 | http://localhost:5173 | ✅ 运行中 |
| SSH 服务 | localhost:22 | ✅ 运行中 |

---

**开发者**: 全栈编码专家 阿宅 🤓
**更新时间**: 2026-03-12 21:00