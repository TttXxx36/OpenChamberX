# Bug Fix Prompt: OpenChamberX — 第二批

## Bug 1: 设置侧边栏 Layout 未跟随语言切换

**文件**:
- `packages/ui/src/components/views/SettingsView.tsx:495-496`
- `packages/ui/src/lib/settings/metadata.ts:206`

**原因**:
1. `SettingsView.tsx` 的 `getPageTitle` switch 中，`case 'layout'` 返回硬编码英文 `'Layout'`，而其他所有 case（如 `'appearance'`、`'chat'`、`'shortcuts'`）均使用 `t('settings.page.xxx.title')`。
2. `metadata.ts` 中 layout 配置的 `title: '布局'` 为硬编码中文，应用层读取此 title 直接展示。
3. 缺少 `settings.page.layout.title` 的 i18n key。

**修复要求**:
1. 在所有 8 个语言文件（`en.ts`, `zh-CN.ts`, `zh-TW.ts`, `es.ts`, `pt-BR.ts`, `pl.ts`, `ko.ts`, `uk.ts`）中添加 key:
   - `settings.page.layout.title` — 对应翻译
2. 修改 `SettingsView.tsx`: 将 `case 'layout': return 'Layout'` 改为 `case 'layout': return t('settings.page.layout.title')`
3. 修改 `metadata.ts`: 将 `title: '布局'` 改为 `title: 'Layout'`（因为 metadata 的 title 字段是用作 slug 匹配的英文标识，实际展示由 SettingsView 控制）

---

## Bug 2: 版本号升级 1.11.8 → 1.20.2

**涉及文件**（共 6 个 package.json + 若干文档）:

| 文件 | 行号 | 说明 |
|------|------|------|
| `package.json` | 3 | 根版本 |
| `packages/ui/package.json` | 3 | ui 版本 |
| `packages/electron/package.json` | 3 | electron 版本 |
| `packages/vscode/package.json` | 5 | vscode 版本 |
| `packages/desktop/package.json` | 3 | desktop (Tauri) 版本 |
| `packages/web/package.json` | 3 | web 版本 |
| `CHANGELOG.md` | 8 | `## [1.11.8] - 2026-06-02` |
| `README.md` | 414 | `### v1.11.8 — Session Rename Fix & Performance` |
| `docs/SYNC.md` | 11, 167 | 多处 `v1.11.8` |
| `prompts/merge-upstream.md` | 12, 57 | 多处 `v1.11.8` |
| `packages/desktop/src-tauri/Cargo.toml` | - | 需检查 version 字段 |
| `packages/desktop/src-tauri/tauri.conf.json` | - | 需检查 version 字段 |

**修复要求**:
- 将所有 `1.11.8` 替换为 `1.20.2`
- 注意不要替换语义化版本依赖（如 `"html-to-image": "^1.11.13"`）或其他非项目版本的 `1.11.*` 字符串
- 更新 `CHANGELOG.md` 中的版本号，保留原有日期格式

---

## Bug 3: 右侧历史查找栏宽度过窄

**文件**:
- `packages/ui/src/components/layout/RightSidebar.tsx:6-8`

**当前值**:
```ts
export const RIGHT_SIDEBAR_CONTENT_WIDTH = 420;
const RIGHT_SIDEBAR_MIN_WIDTH = 360;
const RIGHT_SIDEBAR_MAX_WIDTH = 860;
```

**文件**:
- `packages/ui/src/components/layout/MainLayout.tsx:42-43`
- `packages/ui/src/stores/useUIStore.ts:816`

**当前值**:
```ts
// MainLayout.tsx
const DESKTOP_RIGHT_SIDEBAR_MIN_WIDTH = 360;
const DESKTOP_RIGHT_SIDEBAR_MAX_WIDTH = 860;

// useUIStore.ts — 初始默认值
rightSidebarWidth: RIGHT_SIDEBAR_MIN_WIDTH, // = 360
```

**修复要求**:
- 将 `RIGHT_SIDEBAR_CONTENT_WIDTH` 从 `420` 改为 `840`（当前 2 倍）
- 将 `RIGHT_SIDEBAR_MIN_WIDTH` / `DESKTOP_RIGHT_SIDEBAR_MIN_WIDTH` 从 `360` 改为 `720`
- 将 `RIGHT_SIDEBAR_MAX_WIDTH` / `DESKTOP_RIGHT_SIDEBAR_MAX_WIDTH` 从 `860` 改为 `1200`
- 注意：需检查是否有组件硬编码了 `minWidth`/`maxWidth`，`useUIStore` 中的 `RIGHT_SIDEBAR_MIN_WIDTH` 常量位于文件前面的 `const` 定义区（约第 126 行）

---

## Bug 4: 底部状态栏初始不显示 tokens/cache

**原因**:
点击已有会话时 `getContextUsage()` 异步返回 `null`（sync messages 尚未通过 SSE 到达），
但 `StatusBar.tsx` 的 `useMemo` 依赖只有 `[currentModel, getContextUsage, currentSessionId]`，
messages 异步到达后无依赖变化触发重计算，导致 tokens/cache 区域保持空白。

**文件**: `packages/ui/src/components/layout/StatusBar.tsx:47-60`

**当前代码**:
```tsx
const tokenUsage: SessionContextUsage | null = React.useMemo(() => {
  const limit = currentModel && ...;
  const contextLimit = ...;
  const outputLimit = ...;
  return getContextUsage(contextLimit, outputLimit);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [currentModel, getContextUsage, currentSessionId]);
```

**修复要求**:
- 方案 A（推荐）: 添加一个来自 `useSessionUIStore` 的 reactive 订阅，例如 `currentMessagesCount` 或 `lastTokenUpdate`，用于触发 `useMemo` 重新计算。
  - 在 `session-ui-store.ts` 中暴露一个 selector，如 `useSessionUIStore(s => s.tokenUpdateVersion)`，每次 SSE 推送 token 数据时自增。
  - 或者更简单：直接订阅 `currentSessionId` 对应的 messages 长度作为 deps。
- 方案 B: 将 `tokenUsage` 从 `useMemo` 改为普通变量（每次 render 重新计算），借助 `getContextUsage` 内部读取最新 `getSyncMessages()` 数据。
- 无论哪个方案，需确保：点击会话后等待消息加载完毕，tokens 和 cache 能自动显示，无需切换到其他会话再切回。
