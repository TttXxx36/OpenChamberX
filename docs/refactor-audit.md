# OpenChamber 重构调研报告

> 生成工具：CodeGraph v0.9.3 | 索引：16,042 节点 / 14,689 边 / 1,002 文件

---

## 1. Zustand Store 分析

### 已识别的 Store

| Store 文件 | 符号数 | 风险 |
|------------|--------|------|
| `useUIStore.ts` | **74** | 🔴 巨型 monolith，混装 UI 状态 + 功能状态 |
| `useConfigStore.ts` | 70 | 🟡 大但合理（配置聚合） |
| `useGitStore.ts` | 72 | 🟡 |
| `useAgentsStore.ts` | 49 | 🟢 |
| `useSessionUIStore.ts` | 49 | 🟢 |
| `useUIStore` **核心问题** | | |
| | - ~50+ 字段：sidebar、theme、dialog、terminal、chat 模式混在一起 | |
| | - 虽有用 leaf selector（良好），但字段扩散到 30+ 组件 | |
| | - 高频字段（如 `isExpandedInput`）与低频字段（如 `isAboutDialogOpen`）同店 | |

### createStore 模式
- packages/ui 使用 `create<Store>()()` 模式（Zustand v5）
- 暂未发现 `createStore` 的单独调用（均通过 `create` 直接创建）

---

## 2. React.memo 覆盖

仅 10 处使用 React.memo：

| 组件 | 文件 |
|------|------|
| `MemoModelControls` | ChatInput.tsx |
| `MemoBrowserVoiceButton` | ChatInput.tsx |
| `MemoMobileAgentButton` | ChatInput.tsx |
| `ChatInput` (完整组件) | ChatInput.tsx |
| `SortableGroupItem` | sortableItems.tsx |
| `SessionNodeItem` (+ custom comparator) | SessionNodeItem.tsx |
| `ChatViewport` | ChatContainer.tsx |
| `TurnBlock` | MessageList.tsx |

### 缺少 memo 的热点组件

| 组件 | 位置 | 理由 |
|------|------|------|
| **`ChatMessage`** | ChatMessage.tsx | 每条消息渲染，streaming 期间高频重建 |
| **`MessageList`** | MessageList.tsx | 内含 turns 映射，可能因父级状态变化重建 |
| **`TurnBlock`** | MessageList.tsx | 已 memo，可进一步细化比较器 |
| **`UserTextPart`** | chat/message/parts/ | 从 useUIStore 导入，可作为优化点 |

---

## 3. SSE Event Pipeline

### 已实现的优化 ✅
- 按键 coalesce（`session.status`、`message.part.delta`）
- 按 directory 分队列
- flushDir 批次处理

### 可改进空间
- `message.part.delta` 在 streaming 期间 60/sec，检查 reducer 侧是否存在 findIndex/filter 热点
- `event-reducer.ts` 需要进一步分析

---

## 4. API 错误处理

- useUpdateStore.ts 使用 `useUIStore.getState().reportUsage`（getState 正确方式 ✅）
- 部分 API 方法缺少 fetch failure 与 empty success 的区分
- 需要审计所有 `/api/` 路径的调用方 error handling

---

## 5. 建议优先级

| 优先级 | 改项 | 预估风险 |
|--------|------|----------|
| P0 | useUIStore 按变更频率拆分 | 高（重构后需全面回归） |
| P1 | ChatMessage + MessageList 加 React.memo | 低（纯新增包装） |
| P2 | ChatMessage 定制的 memo comparator | 低 |
| P3 | API error handling 审计 | 中 |
| P4 | Electron main.mjs 异常兜底 | 低 |
