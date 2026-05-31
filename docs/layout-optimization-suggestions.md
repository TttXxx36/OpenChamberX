# OpenChamber 桌面应用布局优化与功能建议

> 基于对 MainLayout、Sidebar、RightSidebar、ContextPanel、Header、TerminalDock 及 Electron 主进程的全面分析

---

## 当前布局痛点

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 1 | **ContextPanel 使用 absolute 定位浮在主内容区上方**，不是独立的面板，与主视图重叠 | MainLayout.tsx | 主视图内容被遮挡，用户困惑 |
| 2 | **ContextPanel 和 RightSidebar 争夺右侧空间** — 一个在 chat-frame 边框内，一个在边框外 | MainLayout.tsx | 布局层级混乱，视觉边界不清 |
| 3 | **主视图全部用 absolute inset-0 + ChatView 永远在 DOM 中** | MainLayout.tsx | 内存浪费，隐藏视图仍在渲染 |
| 4 | **无可拖拽停靠/分离面板系统** — 面板位置固定，无法自由拖动重组 | 全局 | 灵活性差，用户无法自定义工作区 |
| 5 | **多窗口共享同一面板状态** — mini-chat 窗口和主窗口使用同一个 useUIStore | MainLayout.tsx | 面板设置全局影响，无法独立 |
| 6 | **RightSidebar 只有 3 个硬编码 tab** — 不可扩展 | RightSidebarTabs.tsx | 无法添加新的侧边工具 |
| 7 | **底部终端不支持分屏/多 tab** — 单一面板 | BottomTerminalDock.tsx | 多个终端场景需要使用额外窗口 |
| 8 | **`hasManuallyResized*` 标志位不持久化** — 重启后复位 | useUIStore.ts | 用户每次重启需重新调整面板 |

---

## 布局优化建议（高优先级）

### 1. ContextPanel → RightSidebar 合并

**现状：** ContextPanel 在 chat-frame `<div>` 内用 `absolute` 定位，RightSidebar 在外层。两者同时打开时布局混乱。

**建议：** 将 ContextPanel 的所有 tab（diff/file/context/plan/chat/preview/browser）作为 RightSidebar 的额外 tab 页签。RightSidebar 统一变为：
```
RightSidebar
├── Git tab
├── Files tab
├── Context tab  (原 ContextPanel 的多 tab 系统)
│   ├── Diff
│   ├── File
│   ├── Context
│   ├── Plan
│   ├── Chat
│   ├── Preview
│   └── Browser
└── [新增 tab 的扩展入口]
```

**好处：**
- 消除 absolute 定位的视觉混乱
- 统一右侧面板体验
- 减少布局层级（chat-frame 不再需要处理 ContextPanel）
- RightSidebar 宽度控制同时作用于所有右侧内容

### 2. 视图切换从 absolute 层叠改为条件渲染

**现状：** ChatView 永远在 DOM 中 (`invisible`)，其他视图用 `absolute inset-0` 层叠。

**建议：** 使用条件渲染 + `<AnimatePresence>` 实现视图切换：
- ChatView 作为默认视图（always mounted）
- 其他视图在切换时 mount/unmount
- 切换动画（fade/slide）保持流畅
- 减少内存占用

### 3. Activity Bar 模式（VS Code 风格）

**现状：** Header 中的 tab 切换（chat/plan/git/diff/terminal/files）挤在顶部，和 session 切换器等控件混在一起。

**建议：** 活动栏模式：
```
┌─────────────────────────────────────────┐
│           Header (会话切换、设置等)          │
├────┬────────────────────────────────────┤
│    │                                    │
│ A  │         MAIN CONTENT               │
│ C  │                                    │
│ T  │   ChatView / PlanView / GitView    │
│ I  │   DiffView / TerminalView / Files  │
│ V  │                                    │
│ I  │                                    │
│ T  ├────────────────────────────────────┤
│ Y  │         Status Bar                  │
│    │  Model: Sonnet | Tokens: 1.2k | 🟢  │
├────┴────────────────────────────────────┤
│            Right Sidebar                 │
│     Git | Files | Context (+ 扩展)       │
└─────────────────────────────────────────┘
```

- 左侧垂直 Activity Bar 放置主要视图图标
- Header 简化为会话切换、全局设置
- 底部 Status Bar 显示模型、token 用量、Git 分支、Agent 状态

### 4. 可拖拽面板停靠系统

**现状：** 面板位置完全固定，用户无法自定义。

**建议：** 引入面板停靠框架（如 `react-resizable-panels`）：
- Terminal 可拖拽到右下方、左下方或浮窗
- ContextPanel 可拖拽到右侧停靠或分离为独立窗口
- 面板布局可保存为 preset（"开发模式"、"审查模式"、"最小模式"）
- 支持 split view（左右分屏显示两个视图）

### 5. 面板状态持久化增强

**现状：** `hasManuallyResizedLeftSidebar` 等标志位不持久化，重启丢失。

**建议：** 将所有 `hasManuallyResized*` 标志位加入 `partialize`，保存到 localStorage。同时保存：
- 面板布局 preset（命名+描述）
- 每个 preset 包含所有面板的 open/close、width/height、tab 选择
- 默认提供 2-3 个预设（"完整"、"极简"、"审查"）

### 6. 底部 Status Bar

**现状：** 底部只有可选的 Terminal Dock，没有任何状态信息。

**建议：** 增加 VS Code 风格的 Status Bar：
```
左侧: Git 分支 ↑1 ↓0 | 💬 当前 Agent | ⚡ 会话时长
右侧: Model: Sonnet 4.6 | 🪙 1,234 tokens | 🟢 已连接 | 📶 延迟 120ms
```
- 可点击（点击 Git 分支切换到 Git 视图，点击 Model 切换模型）
- 可自定义显示项
- Terminal Dock 打开时 Status Bar 在 Terminal 上方

---

## 功能建议（中优先级）

### 7. AI Commit Message 生成器

- 在 Git 视图的 staged changes 面板增加 "Generate commit message" 按钮
- 调用 OpenCode agent 分析 staged diff 生成符合 Conventional Commits 规范的消息
- 支持编辑、重新生成、复制

### 8. 会话标签与书签

- 允许用户在对话中标记关键 turn（加标签、写备注）
- 支持按标签搜索/过滤会话
- 书签面板在 RightSidebar 作为新 tab

### 9. Prompt 库

- 右侧 sidebar 新增 "Prompts" tab
- 保存、分类、搜索常用的 prompt 模板
- 一键插入当前对话
- 支持变量替换（`{{file_path}}`、`{{selected_code}}`）

### 10. 工作流构建器

- 可视化 pipeline 编辑器
- 拖拽添加步骤：代码分析 → 生成测试 → 审查 → 提交
- 一键运行工作流，实时显示进度
- 保存为可复用的工作流模板

### 11. 用量与性能仪表板

- 替代当前的简单 UsagePage
- 图表展示：每日 token 消耗、请求次数、模型使用分布
- 会话级别：tokens per session、响应时间、模型切换历史
- 成本估算（基于 model cost 配置）

### 12. 多项目管理面板

- 在启动页/侧边栏展示所有项目概览
- 每个项目显示：最近会话数、Git 状态、未提交变更数
- 拖拽排序、分组

---

## 实现路径建议

### Phase 1 — 布局修复（≈影响最小、收益最大）

```
1. ContextPanel → RightSidebar 合并
2. 视图切换从 absolute 改为条件渲染
3. hasManuallyResized* 持久化
4. RightSidebar tab 扩展入口
```

### Phase 2 — 布局增强

```
5. Status Bar 组件
6. Activity Bar 模式（可选开启）
7. 面板状态 preset 保存
```

### Phase 3 — 新功能

```
8. AI Commit Message 生成器
9. 会话书签/标签系统
10. Prompt 库
11. 用量仪表板
```

### Phase 4 — 高级

```
12. 可拖拽面板停靠系统
13. 工作流构建器
14. 多项目管理面板
```
