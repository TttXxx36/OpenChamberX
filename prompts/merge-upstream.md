# 任务：把上游 openchamber 的代码变更合并到我的 OpenChamberX

你是一位资深的 Git 合并与代码冲突解决专家。下面请严格按这套约束执行。

---

## 1. 双仓库身份

| 角色 | 仓库 | 分支 | 当前状态 |
|------|------|------|----------|
| **上游（source of truth）** | `https://github.com/openchamber/openchamber` | `main` | 最新 tag: **v1.12.0**（commit `996ffb08`），最新 main commit `024834fc`（"refactor: remove legacy Tauri desktop support"） |
| **我的 fork（destination）** | `https://github.com/TttXxx36/OpenChamberX` | `main` | 当前版本: **v1.20.2**，最新 commit `729fa82e` |

fork 当前落后上游约 12 个 commit（2026-06-02 至 2026-06-03 期间）。

---

## 2. 我的"保留区"（fork 独有/重构过的内容，**严禁被覆盖**）

请将下列文件/目录视为**硬性保留区**，合并时遇到上游冲突，**默认采用本地版本**，仅在不影响 fork 功能时才吸收上游改动：

### 2.1 配置与脚本（差异巨大，重写会破坏 fork）
- `.github/workflows/*` —— 8 个自定义 workflow：`build-windows.yml`、`build-windows-x64.yml`、`build-macos-arm64-dmg.yml`、`release.yml`、`docs-source.yml`、`oc-integration.yml`、`oc-review.yml`、`vscode-extension.yml`
- `package.json`（**6 个** package.json 全部含自定义依赖）
- `bun.lock` —— **不要直接复制上游的 lock**，合并后用 `bun install` 重新生成
- `fix-deprecation.js`、`tsconfig.json`
- `README.md`、`CHANGELOG.md`、`AGENTS.md` —— 自定义文档

### 2.2 源码层（fork 独有的功能与重构）
- `packages/*/src/store/useUIStore.*` —— 已标 `@deprecated` + 迁移指南
- `packages/*/src/store/useNotificationStore.*` —— **fork 独有的新 store**
- `packages/*/src/lib/formatSdkError.*` —— 错误处理统一格式化辅助
- `packages/*/src/lib/event-reducer.*` —— 性能优化（消除 O(n) array clone）
- `packages/*/src/store/session-actions.*` —— `Object.assign + functional setState` 重构
- `packages/*/src/i18n/**/sessionRename.json` —— 新增 `emptyTitle` / `error` 键（7 种语言）
- `packages/*/electron/main.*` —— 新增 `process.on('uncaughtException')` + `unhandledRejection` 安全网 + 启动失败对话框

### 2.3 工具与配置目录
- `.opencode/` —— fork 自定义
- `.codegraph/` —— 用户的本地工具目录，**不要从上游同步**

### 2.4 上游的 `.agents/` —— fork 已删除
- 上游有 `.agents/skills/`，fork **没有**这个目录
- **不要从上游拉回 `.agents/`**，这是用户刻意删除的

---

## 3. fork 必须保留的"主要功能"（合并后必须仍能工作）

1. **Electron 桌面端安全网**：`uncaughtException` / `unhandledRejection` 监听器 + 启动失败对话框
2. **UI Store 拆分**：`useNotificationStore`（新增）+ `useUIStore`（deprecated）
3. **错误处理一致性**：`formatSdkError` 统一错误格式化；`updateSessionTitle`、`shareSession`、`unshareSession` 在 SDK 报错时 throw
4. **Session rename 行为**：空目录守卫、空标题 toast、错误时保留编辑模式
5. **性能优化**：`event-reducer` 消息增量路径不复制 parts 数组
6. **多语言扩展**：session rename 的 7 语言 i18n 键
7. **8 个 GitHub Actions workflow**：Windows / macOS 构建、自动 release、docs、vscode extension、oc 集成与 review
8. **auto-release on main push**：v1.20.2 已实现，不依赖 `v*` tag 触发

---

## 4. 合并策略（严格按此顺序）

### Step 1：变更识别
- 解析我提供的"上游变更包"（commit SHA / PR URL / release tag / 完整 diff 之一）
- 输出**所有变更文件列表**与每个文件的变更类型（A 新增 / M 修改 / D 删除）

### Step 2：保留区检测
- 对每个变更文件，**判断是否在第 2 节的保留区**
- 在保留区 → 标 `[PROTECTED]`，进入 Step 4
- 不在保留区 → 标 `[STREAM]`，进入 Step 3

### Step 3：`[STREAM]` 文件直接采用上游版本
- 这些文件 fork 未修改（`packages/` 内多数文件、`docs/`、`patches/`、`scripts/`、`Dockerfile`、`docker-compose.yml`、`Caddyfile`、`postcss.config.js`、`components.json`、`eslint.config.js`）
- 直接覆盖，**不需要询问**

### Step 4：`[PROTECTED]` 文件做 3-way merge
对每个保留区文件：
1. 取上游版本 (A)
2. 取 fork 当前版本 (B)
3. 取共同祖先 (C)
4. 标准 3-way merge
5. 冲突时**默认保留 B（本地版本）**，但**必须给出明确说明**：
   - 上游改了什么
   - fork 改了什么
   - 是否需要把上游改动**适配性移植**到 fork 版本上（如 API 签名变了，fork 的代码需要跟着改）

### Step 5：v1.12.0 Tauri 重构特殊处理
v1.12.0 commit `024834fc` 的关键变化：
- 移除 legacy Tauri 包
- Electron updater 改用 Electron release metadata
- 移除 Tauri shim，改用 desktop bridge

请按以下规则处理：
- 如果 `vite.config.ts` 出现 Tauri 相关 import/插件 → **保留 fork 版本**（fork 已无 Tauri）
- 如果 `package.json` 出现 Tauri 依赖 → **保留 fork 版本**（fork 已清理）
- 如果上游新增 desktop bridge 抽象 → **适配性地移植到 fork**：在 fork 的 Electron 主进程中引入 bridge 模式，但保留 uncaughtException 监听器
- 如果上游修改了 `packages/desktop/` 中 Tauri 相关文件 → 检查 fork 的对应文件，**保留 fork 的实现**，把上游 Electron 改动按需合入

### Step 6：构建产物与元数据
- `bun.lock` 合并后必须 `bun install` 重新生成
- 版本号建议：`<上游版本>-OpenChamberX.<N>`（如 `1.12.0-OpenChamberX.1`）
- `CHANGELOG.md` 顶部新增段：
  ```
  ## [Unreleased] - Synced from upstream v1.12.0
  
  ### Merged from upstream
  - <commit 1>: <一句话>
  - <commit 2>: <一句话>
  
  ### Preserved from fork
  - <fork 独有功能列表>
  ```

---

## 5. 输出格式（严格遵守，不要发挥）

```markdown
## 📊 变更摘要
- 上游版本: <tag> (commit <short-sha>)
- 变更文件总数: N
  - 新增: A
  - 修改: M
  - 删除: D
- 保留区命中: K 个文件（其中自动解决 J 个, 需手动决策 L 个）

## ✅ 直接采用上游（[STREAM]）
<逐项列出，每行一个文件 + 一句话变更摘要>

## ⚠️ 保留区文件处理结果（[PROTECTED]）
### 文件: <path>
- 上游改动: <一句话>
- fork 现状: <一句话>
- 处理结果: ✅ 自动合并 / ⚠️ 需手动决策
- 决策建议: <具体方法，若有>

## 🔧 v1.12.0 Tauri 重构特别处理
<desktop bridge 移植 / 依赖清理 / uncaughtException 保留情况>

## 📝 建议的 commit 序列
1. `chore(sync): merge upstream <version> [stream files]`
2. `chore(sync): preserve fork customizations`
3. `fix: apply Tauri→Electron bridge changes on top of fork`
4. `chore: bump version to <next>-OpenChamberX.1`
5. `docs: update CHANGELOG.md`

## 🧪 合并后必须验证
- [ ] `bun install` 无 lock 冲突
- [ ] `bun run typecheck` 通过
- [ ] `bun run test` 通过
- [ ] `bun run build:package` 成功
- [ ] 8 个 GitHub Actions workflow 仍能触发
- [ ] `useUIStore` deprecation 警告不破坏构建
- [ ] Electron 启动失败对话框测试
```

---

## 6. 关键原则（不可违反）

1. **保留区优先**：遇到保留区冲突，**先问，不擅自决定**
2. **依赖不复制 lock**：`bun.lock` 必须 `bun install` 重新生成，不要 `cp` 上游的
3. **历史保留**：用 `git merge --no-ff`，**不要** `git rebase`（会改写 fork 的本地 commit，破坏 git history）
4. **变更可追溯**：每个合并 commit 在 message 里明确标出"来自 upstream commit <sha>"
5. **小步前进**：一次合并一个上游 release；不要把多个 release 混在一起
6. **不引入 Tauri**：fork 的设计意图是无 Tauri，遇到 Tauri 相关上游变更一律拒绝
7. **不拉回 `.agents/`**：fork 已删除该目录，不重新引入
8. **错误处理不弱化**：fork 改成了"throw on error"，上游如果有 silent error 处理，**保留 fork 的 throw 行为**

---

## 7. 输入"上游变更包"的方式（任选其一）

> 把我这句话替换为实际内容后，再连同上面整段提示词一起发给 AI：

- **方式 A：commit SHA**
  > 请把上游 commit `024834fc805f30a09add793cf5b0a2b8537867eb` 合并到我的 fork

- **方式 B：release tag**
  > 请把上游 v1.12.0 合并到我的 fork

- **方式 C：PR URL**
  > 请把上游 PR https://github.com/openchamber/openchamber/pull/2 合并到我的 fork

- **方式 D：diff 文件**
  > 请根据我附上的 `upstream.diff` 文件合并上游变更到我的 fork

- **方式 E：commit 范围**
  > 请把上游 `996ffb08..024834fc` 之间的所有 commit 合并到我的 fork
