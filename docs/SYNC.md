# OpenChamberX 同步策略文档

> 本文档说明如何将 `openchamber/openchamber` 上游的代码变更持续同步到 `TttXxx36/OpenChamberX` fork，同时保留 fork 的自定义功能与重构。

## 1. 背景

OpenChamberX 是 [openchamber](https://github.com/openchamber/openchamber) 的 fork。fork 在以下方面与上游不同：

| 维度 | 上游 | fork (OpenChamberX) |
|------|------|---------------------|
| 当前版本 | v1.12.0 | v1.20.3 |
| UI Store | 单 `useUIStore` | 拆分为 `useUIStore` (deprecated) + `useNotificationStore` (新) |
| 错误处理 | 部分 silent error | 统一 `formatSdkError` + throw on error |
| 性能 | 标准实现 | `event-reducer` 消除 O(n) array clone |
| 桌面端安全网 | 无 | Electron `uncaughtException` / `unhandledRejection` + 启动失败对话框 |
| i18n | 基础 | sessionRename 新增 7 语言 `emptyTitle` / `error` 键 |
| GitHub Actions | 基础构建 | 8 个 workflow（Windows / macOS / release / docs / oc-*） |
| 依赖 | 最小 | 多个自定义依赖 |
| `.agents/` | 存在 | **已删除** |
| `.codegraph/` | 无 | 存在（用户本地工具） |
| 文档 | 上游版本 | 定制版本（README/CHANGELOG/AGENTS） |

## 2. 同步方案

我们提供 **三层防御** 的同步策略：

```
┌──────────────────────────────────────────────────────────────┐
│  Layer 1: 每天 UTC 06:00 自动检查 (GitHub Actions)            │
│  → 检测上游新版本 → 自动开 PR → 人工 review 后合入            │
├──────────────────────────────────────────────────────────────┤
│  Layer 2: 冲突时自动开 Issue（不强推）                        │
│  → 列出冲突文件 + 解决步骤 + 提示词入口                       │
├──────────────────────────────────────────────────────────────┤
│  Layer 3: 手动精细控制（prompts/merge-upstream.md）          │
│  → 用 AI 辅助的合并提示词，逐个 commit 决策                   │
└──────────────────────────────────────────────────────────────┘
```

## 3. 快速开始

### 3.1 安装到 fork 仓库

将以下文件复制到 fork 仓库的对应位置：

```
prompts/merge-upstream.md              →  prompts/merge-upstream.md
.github/workflows/sync-upstream.yml    →  .github/workflows/sync-upstream.yml
.github/sync-config/protected-paths.txt →  .github/sync-config/protected-paths.txt
scripts/sync-upstream.sh               →  scripts/sync-upstream.sh
docs/SYNC.md                           →  docs/SYNC.md
```

或者直接用以下命令一次性复制（假设已 clone 本 toolkit）：

```bash
cd path/to/OpenChamberX
cp -r path/to/openchamberx-sync-toolkit/prompts/ .
cp -r path/to/openchamberx-sync-toolkit/.github/ .
cp -r path/to/openchamberx-sync-toolkit/scripts/ .
mkdir -p docs && cp path/to/openchamberx-sync-toolkit/docs/SYNC.md docs/
git add . && git commit -m "chore: add upstream sync toolkit"
git push origin main
```

### 3.2 触发同步

**方式 A：等待定时任务**
- 默认每天 UTC 06:00 自动检查
- 首次推送后 24 小时内会跑一次

**方式 B：手动触发**
- 进入 GitHub 仓库 → Actions → "Sync Upstream" → Run workflow
- 可选输入：
  - `upstream_ref`：留空取最新 tag，或填 `v1.13.0` / `024834fc` / `main`
  - `strategy`：默认 `recursive_ours`

**方式 C：本地执行（Windows）**
```powershell
.\scripts\sync-upstream.ps1              # 最新 tag
.\scripts\sync-upstream.ps1 -Ref v1.13.0 # 指定 tag
```

**方式 D：本地执行（Linux/macOS）**
```bash
chmod +x scripts/sync-upstream.sh
./scripts/sync-upstream.sh              # 最新 tag
./scripts/sync-upstream.sh v1.13.0      # 指定 tag
```

### 3.3 处理冲突

**冲突会被自动检测**。workflow 使用三段式保护路径策略处理冲突：

1. `[PRESERVE]` 路径 → **保留 fork 版本**（`git checkout --ours`）
2. `[MERGE_SAFE]` 路径 → **冲突时保留 fork**（`git checkout --ours`）
3. `[STREAM]` 路径 → **直接采用上游**（`git checkout --theirs`）
4. 不属于以上三类的文件若仍冲突 → **开 Issue** `⚠️ Sync conflict` 列出冲突文件
5. 人工解决后 push 到同步分支，workflow 会自动开 PR

**人工解决冲突时**，使用 `prompts/merge-upstream.md` 提示词给 AI 辅助：

> 我把"上游变更包"（如 commit SHA、PR URL、diff 文件）连同提示词一起发给 Claude / GPT / Cursor，AI 会按"保留区优先"原则给出合并建议。

## 4. 保护路径（"保留区"）机制

`protected-paths.txt` 采用三段式分类，决定合并时如何处理每个路径的冲突：

| 分类 | 行为 | 适用场景 |
|------|------|----------|
| `[PRESERVE]` | 完全保留 fork 版本，上游更改忽略 | CI/CD、文档、同步脚本本身 |
| `[MERGE_SAFE]` | 尝试合并，冲突时保留 fork 版本 | 部分 i18n、Electron 安全网 |
| `[STREAM]` | 直接采用上游版本覆盖 | Tauri、VSCode 等 fork 不改的区域 |

当前默认配置（已在 `.github/sync-config/protected-paths.txt` 设置）：

### [PRESERVE] 完全保留

| 类别 | 文件 |
|------|------|
| **CI/CD** | `.github/workflows/`（8 个自定义 workflow） |
| **同步配置** | `.github/sync-config/`, `scripts/sync-upstream.*`, `scripts/merge-with-backup.sh` |
| **文档** | `README.md`, `CHANGELOG.md`, `AGENTS.md`, `CONTRIBUTING.md`, `docs/`, `prompts/` |
| **开发工具** | `.opencode/`, `.codegraph/` |

### [MERGE_SAFE] 自动合并，冲突保留 fork

| 类别 | 文件 |
|------|------|
| **依赖** | `package.json`（×6）+ `bun.lock` |
| **构建配置** | `tsconfig.json`, `vite.config.ts`, `vite-theme-plugin.ts`, `postcss.config.js`, `fix-deprecation.js` |
| **核心重构** | `useUIStore.*`, `useNotificationStore.*`, `formatSdkError.*`, `event-reducer.*`, `session-actions.*` |
| **多语言** | `i18n/messages/*.ts`, `i18n/messages/*.settings.ts` |
| **Electron** | `electron/main.*`, `electron/preload.*` |
| **Fork 功能** | `StatusBar.tsx`, `ChatScrollMarkers.tsx`, `ChatContainer.tsx`, `LayoutPage.tsx`, `MainLayout.tsx`, `SettingsView.tsx` |

### [STREAM] 直接采用上游

| 类别 | 文件 |
|------|------|
| **Tauri** | `desktop/src-tauri/` |
| **VSCode** | `vscode/` |

### 4.1 添加新的保护路径

```bash
# 编辑文件
vim .github/sync-config/protected-paths.txt

# 添加新行（glob 模式）
/packages/web/src/components/MyCustomComponent.*

# 提交
git commit -am "chore(sync): add new protected path"
```

### 4.2 暂时解除保护

如果某次同步确实需要覆盖某个保护路径，有两种方法：

**方法 A：临时编辑 protected-paths.txt**
1. 注释掉要解除保护的那一行
2. 触发 workflow
3. 同步后恢复注释

**方法 B：手动合并该路径**
1. workflow 开 PR 后
2. 在 PR 分支上手动编辑该文件
3. commit push

## 5. 合并策略详解

同步使用 `git merge --no-commit` 分步策略，而非单次 `-X ours/theirs`：

1. 先执行 `git merge --no-ff --no-commit` 尝试自动合并
2. 无冲突 → 正常提交
3. 有冲突 → 按三段式逐文件处理：
   - `[STREAM]` → `git checkout --theirs`
   - `[PRESERVE]` → `git checkout --ours`
   - `[MERGE_SAFE]` → `git checkout --ours`
   - 其他未分类文件 → 暴露给用户处理
4. 提交已解决的合并，未解决的通过 Issue 通知

## 6. 上游重大变更处理手册

### 6.1 v1.12.0: 移除 legacy Tauri

- 上游 commit: `024834fc`
- 关键变化：移除 `packages/tauri/`, Tauri shim 改用 desktop bridge
- **fork 处理**：
  - ✅ 保留 fork 现状（fork 无 Tauri）
  - ❌ 拒绝任何引入 Tauri 的上游变更
  - ⚠️ 如果上游 desktop bridge 设计对 fork 的 Electron 实现有用，**手动移植**到 fork 的 `electron/main.*` 中

### 6.2 v1.11.x → v1.12.x: 自动 release 机制

- 上游用 `v*` tag 触发 release
- fork 改为"main push 自动 release"（v1.20.3 起）
- **同步时保留 fork 的 release workflow**

### 6.3 未来可能遇到的变化

- **新增 .agents/ 目录**：fork 显式排除（见 protected-paths.txt）
- **CI 工作流大改**：检查 fork 的 8 个 workflow 是否仍能识别触发条件
- **依赖升级**：合并后必须 `bun install` 重新生成 lock

## 7. 验证清单（每次同步后必做）

- [ ] `bun install` 无 lock 冲突
- [ ] `bun run typecheck` 通过
- [ ] `bun run test` 通过
- [ ] `bun run build:package` 成功
- [ ] 8 个 GitHub Actions workflow 仍能被识别
- [ ] `useUIStore` deprecation 警告不破坏构建
- [ ] Electron 启动失败对话框测试
- [ ] 多语言 7 种语言的 sessionRename 键未缺失
- [ ] `event-reducer` 性能优化未回退

## 8. 回滚方案

如果同步后出问题了：

**回滚单个 sync commit：**
```bash
git revert -m 1 <sync-commit-sha>
git push origin main
```

**回滚到同步前：**
```bash
# 找到同步前 main 的 commit
git log --oneline main | grep -v "chore(sync)"
git reset --hard <commit-before-sync>
git push --force-with-lease origin main
```

**删除同步分支：**
```bash
git branch -D sync/upstream-v1.12.0-abc1234
git push origin --delete sync/upstream-v1.12.0-abc1234
```

## 9. 扩展阅读

- `prompts/merge-upstream.md` —— AI 合并提示词完整版
- `scripts/sync-upstream.sh` —— 本地同步脚本（与 GitHub Action 等价）
- [.github/sync-config/protected-paths.txt](../.github/sync-config/protected-paths.txt) —— 保护路径配置

## 10. 维护建议

- **每 2 周**review 一次 `protected-paths.txt`，看是否需要新增保护项
- **每次上游大版本**（如 v1.13、v2.0）后，手动 review sync 行为
- **每季度**检查上游是否在迁移到与 fork 不同的技术栈（如换框架），提前评估 fork 维护成本
