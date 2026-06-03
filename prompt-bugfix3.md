# Bug Fix Prompt: OpenChamberX — 第三批

## Bug 1: 左侧栏最小宽度实际卡在 280px

**现象**: 代码中 `LEFT_SIDEBAR_MIN_WIDTH = 160`，拖动缩放至约 260px 后无法继续缩小。

**根因**: `Sidebar.tsx` 有私有常量 `SIDEBAR_MIN_WIDTH = 280`（第 8 行），拖动缩放时的 clamp 函数（`clampSidebarWidth`）使用此私有常量而非 store 的 `LEFT_SIDEBAR_MIN_WIDTH`。store 的 `LEFT_SIDEBAR_MIN_WIDTH = 160` 只在初始默认值和布局预设中使用。

**涉及文件**:
- `packages/ui/src/components/layout/Sidebar.tsx:7-9` — 私有常量 `SIDEBAR_MIN_WIDTH = 280`
- `packages/ui/src/components/layout/Sidebar.tsx:29-31` — `clampSidebarWidth` 函数
- `packages/ui/src/components/layout/Sidebar.tsx:62-65` — `openWidth` 计算
- `packages/ui/src/stores/useUIStore.ts:125` — 导出 `const LEFT_SIDEBAR_MIN_WIDTH = 160`

**修复要求**:
1. 同步 Sidebar.tsx 的 `SIDEBAR_MIN_WIDTH` 与 store 的值
2. 推荐方案：从 `useUIStore.ts` 导出 `LEFT_SIDEBAR_MIN_WIDTH`，Sidebar.tsx 导入并使用该值
3. 或者简单地将 `SIDEBAR_MIN_WIDTH` 改为 `160`

---

## Bug 2: 右侧小横条(ChatScrollMarkers)跳转修复与重构

**现象**:
1. 在对话最底部点击小横条无反应
2. 点击错位：想跳转到上一个问题，实际跳到下一个
3. 小横条相互影响，希望每个独立工作

**根因分析**:

### 问题 1: 最底部点击无反应
- `MessageList` 使用虚拟列表，旧消息 DOM 可能被回收，`querySelector([data-message-id=...])` 返回 null
- 回退到 `messageListRef.current?.scrollToMessageId()` 可能也返回 false（索引越界或 `scrollHistoryIndexIntoView` 失败）
- `pointer-events-none` 容器 + `pointer-events-auto` 按钮在底部可能被其他元素（如 padding spacer）遮挡

### 问题 2: 点击错位
- `scrollToMessageId` 经过多层转发（`ChatScrollMarkers` → `messageListRef` → `useEffect` handle → `scrollMessageElementIntoView` / `scrollHistoryIndexIntoView`）
- `scrollHistoryIndexIntoView` 使用虚拟列表的 `scrollToIndex(index, { align: 'start' })`，但 `messageIndexMap` 构建自 `allEntries`（包含 history + trailing），而 `scrollHistoryIndexIntoView` 检查的却是 `historyEntries.length`，可能存在索引不匹配
- 之前的修复改用 `el.scrollIntoView({ block: 'start' })` 直接定位 DOM，但在虚拟化场景下元素不在 DOM 中

### 问题 3: 相互影响
- 所有小横条是一个 flex 列，上下 gap 固定，点击一个会因布局变化影响其他
- 没有独立的状态追踪，活跃态通过 `activeMessageId` 统一管理

**涉及文件**:
- `packages/ui/src/components/chat/ChatScrollMarkers.tsx` — 完整重写
- `packages/ui/src/components/chat/MessageList.tsx:1556-1569` — `scrollToMessageId`
- `packages/ui/src/components/chat/MessageList.tsx:1507-1523` — `scrollMessageElementIntoView`（offset=50 硬编码偏移）

**修复方案建议**:

### 方案 A（推荐）：完全重写 ChatScrollMarkers

不再使用 `messageListRef` 的复杂管道，改为**直接操作滚动容器**：

```tsx
const scrollToMessage = (messageId: string) => {
  const container = scrollContainerRef.current;
  if (!container) return;

  // 尝试直接查找 DOM 元素
  const el = container.querySelector(`[data-message-id="${messageId}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  // 虚拟化回退：通过 messageListRef
  messageListRef.current?.scrollToMessageId(messageId, { behavior: 'smooth' });
};
```

每个按钮独立绑定自己的 onClick，使用 `useCallback` 隔离。

### 方案 B：修复 `scrollToMessageId` 管道

1. 修复 `MessageList.tsx` 中的 `scrollMessageElementIntoView`：将硬编码 `offset = 50` 改为可配置
2. 修复 `scrollHistoryIndexIntoView`：`messageIndexMap` 的索引应与 `historyEntries` 而非 `allEntries` 对齐
3. 确保 `scrollToMessageId` 在虚拟化状态下也能正确工作

### 性能优化
- 将 `userMessages.map` 的 `findMessageElement` 查询改用一次 `querySelectorAll` 批量收集
- 活跃标记更新改用 `IntersectionObserver` 替代 `requestAnimationFrame` + `getBoundingClientRect` 循环
- 每个 marker 按钮用 `React.memo` 包裹减少不必要的重渲染
