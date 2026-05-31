# OpenChamber 项目分析报告

> 项目：https://github.com/RafaelXokito/openchamber
> 上游：btriapitsyn/openchamber | 版本：1.11.7 | 许可：MIT

---

## 一、项目概述

OpenChamber 是 OpenCode CLI 的图形界面层，提供跨平台的 GUI 交互体验。支持 Web/PWA、macOS 桌面（Tauri）、跨平台桌面（Electron）、VS Code 扩展四种运行模式。

### 核心定位
- 为 OpenCode CLI 提供可视化操作界面
- 支持 diff 查看、agent 管理、终端、Git/GitHub 工作流
- 与 OpenCode 通过 `@opencode-ai/sdk` 通信

---

## 二、整体架构

### 2.1 Monorepo 结构

```
openchamber/
├── packages/
│   ├── ui/          # 共享 UI 组件库（React + Zustand，~240+ 组件）
│   ├── web/         # Web 应用（Vite + Express Server + CLI）
│   ├── desktop/     # Tauri 桌面壳（旧版，仅维护）
│   ├── electron/    # Electron 桌面壳（主推方向）
│   ├── vscode/      # VS Code 扩展
│   └── docs/        # 文档内容（MDX，~85 页）
├── scripts/         # 构建/发布脚本
├── docs/            # 项目级文档和截图
├── patches/         # patch-package 补丁
├── Dockerfile       # 多阶段构建
└── docker-compose.yml
```

### 2.2 数据流架构

```
用户交互 → React 组件 → Zustand Store → @opencode-ai/sdk → OpenCode CLI
                    ↑                              ↓
                SSE/WebSocket ←── OpenCode Server ←──
```

核心模式：UI 通过 Zustand store 管理状态，通过 `@opencode-ai/sdk` 与 OpenCode 通信，通过 SSE/WebSocket 接收事件推送。

### 2.3 关键模块

| 模块 | 位置 | 职责 |
|------|------|------|
| **ChatView** | `ui/src/views/chat/` | 对话主界面、消息渲染、输入框 |
| **DiffView** | `ui/src/views/diff/` | diff 对比查看（stacked/inline） |
| **GitView** | `ui/src/views/git/` | Git 操作、PR、分支管理 |
| **TerminalView** | `ui/src/views/terminal/` | 集成终端（ghostty-web） |
| **FilesView** | `ui/src/views/files/` | 文件浏览器 |
| **PlanView** | `ui/src/views/plan/` | 规划视图 |
| **SettingsView** | `ui/src/views/settings/` | 设置面板（~52 个 section） |
| **MainLayout** | `ui/src/components/layout/` | 主布局（header/sidebar/面板） |

---

## 三、技术栈详情

| 层 | 技术 |
|---|------|
| **语言** | TypeScript 5.8 |
| **UI 框架** | React 19.1 |
| **构建** | Vite 7.1 + Bun 1.3.5 |
| **样式** | Tailwind CSS 4 + CVA + clsx + tailwind-merge |
| **状态管理** | Zustand 5（~40+ stores） |
| **路由** | URL search params 驱动（非 path-based） |
| **编辑器** | CodeMirror 6 |
| **终端** | ghostty-web + Xterm |
| **服务端** | Express 5 + better-sqlite3 + ws |
| **PWA** | vite-plugin-pwa |
| **动画** | motion（原 framer-motion） |
| **命令面板** | cmdk |
| **主题** | next-themes + 自定义 JSON theme（18+ 内置） |
| **图标** | @remixicon/react + 自定义 SVG |
| **测试** | vitest |

---

## 四、代码质量初评

### 4.1 优势
- 组件结构清晰，职责划分合理
- Zustand store 按功能模块拆分，复用性好
- monorepo 依赖管理干净，无显著循环依赖
- 路由使用 URL search params，简单可控
- Web/Desktop/VS Code 通过 RuntimeAPI 抽象层解耦

### 4.2 潜在优化点

#### 性能
- `useUIStore` 是单一大 store（~100+ fields），任何更新都触发大量重渲染 → 需拆分或使用 selector
- 部分列表渲染（session list、message list）未使用虚拟滚动
- CodeMirror editor 可能未做懒加载
- diff viewer 对大文件可能一次性加载全部内容
- 部分组件缺少 `React.memo` / `useMemo`

#### 代码质量
- ESLint 可能存在 warning
- 部分组件类型定义可更严格
- 存在 legacy Radix UI 和 Base UI 混用
- 部分 store 结构过于扁平

#### 包体积
- 可检查是否有重复/冗余依赖
- 路由级别懒加载可优化
- 字体/图标按需加载

---

## 五、构建与部署

| 方式 | 命令 | 输出 |
|------|------|------|
| Web 开发 | `bun run dev:web:hmr` | Vite HMR :5173 + Server :3001 |
| Web 构建 | `cd packages/web && bun run build` | `packages/web/dist/` |
| Web 启动 | `cd packages/web && bun run start` | Node Express 服务 |
| Docker | `docker compose up -d` | 容器 :3000 |
| Electron | `bun run electron:build` | DMG/NSIS |
| VS Code | `bun run vscode:package` | .vsix |

---

## 六、功能扩展建议

以下是为后续功能扩展预留的关键接入点：

1. **自定义 Command** — `packages/ui/src/stores/useCommandsStore.ts` 支持自定义命令注册
2. **自定义 Provider** — `packages/ui/src/stores/useConfigStore.ts` 管理 provider 配置
3. **插件系统** — `packages/ui/src/stores/useMcpStore.ts` MCP 工具管理可作为插件基础
4. **自定义 Theme** — JSON theme 热加载机制
5. **Agent 管理** — `packages/ui/src/views/agent-manager/` 可扩展
