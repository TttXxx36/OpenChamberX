# 上游同步脚本重构提示词

## 背景

仓库 `https://github.com/TttXxx36/OpenChamberX` 是 `https://github.com/openchamber/openchamber` 的 fork。已有同步体系包括：

- `.github/workflows/sync-upstream.yml` — GitHub Actions 每天 UTC 06:00 自动同步
- `scripts/sync-upstream.sh` — 本地同步脚本
- `scripts/merge-with-backup.sh` — 带备份的一键同步脚本
- `docs/SYNC.md` — 同步策略文档
- `prompts/merge-upstream.md` — AI 手动合并提示词
- `.github/sync-config/protected-paths.txt` — 保护路径配置（fork 特有功能不被覆盖）
- Git remote: `origin`(fork) + `upstream`(openchamber)

GitHub Actions 工作流每天自动运行，但实际使用效果不佳。需要重构同步流程。

---

## 已知问题

1. **`-X ours` 策略过于粗暴**：当前 `merge-with-backup.sh` 使用 `recursive_ours` 策略，遇到冲突无条件保留 fork 版本，会静默丢弃上游的变更，导致遗漏重要更新。

2. **保护路径配置颗粒度太粗**：`useUIStore.*`、`session-actions.*` 等整个文件被保护，但如果上游对同一文件有多处改动（部分可合并、部分不可），无法细粒度处理。

3. **同步失败缺乏可观测性**：Actions 运行失败后无告警通知（邮件/钉钉/等），用户不会第一时间发现同步失败。

4. **手动合并流程繁琐**：`prompts/merge-upstream.md` 需要手动把 diff 粘贴给 AI，步骤多、易出错、依赖人工。

5. **本地脚本需要 WSL/msys2**：`.sh` 脚本在 Windows 上无法直接运行，需要 Git Bash 或 WSL，增加了使用门槛。

---

## 重构要求

### 原则

- **保护 fork 独有功能**：不破坏 StatusBar、ChatScrollMarkers、LayoutPage i18n、v1.20.2 版本号等 fork 特有变更
- **不遗漏上游修复**：上游的 bug fix、安全更新、性能优化应尽量合并进来
- **自动化优先**：尽量减少人工介入，失败时自动创建 Issue 描述冲突
- **可观测**：同步结果（成功/失败/部分冲突）应有清晰记录

### 具体修改建议

#### 1. 合并策略改进（核心）

**当前做法**：
```bash
git merge --no-ff $TARGET_SHA -X theirs  # 或 -X ours
```

**建议改为**：

- 使用 `git merge --no-ff --no-commit $TARGET_SHA` 先尝试合并但不提交
- 检查是否有冲突（`git diff --name-only --diff-filter=U`）
- 无冲突：直接提交
- 有冲突：
  - 读取 `.github/sync-config/protected-paths.txt` 的 glob 列表
  - 对保护路径内的冲突文件，使用 `git checkout --ours <file>` 保留 fork 版本
  - 对非保护路径的冲突文件，列出清单并创建 GitHub Issue，由人工处理
  - 提交已自动解决的部分

这样做的好处：
- 保护路径内的冲突自动用 fork 版本 → 保证功能不破坏
- 非保护路径的冲突不静默丢弃 → 用户知道哪些文件需要关注

#### 2. 优化保护路径配置文件

增加分类粒度：

```
# [PRESERVE] - 完全保留 fork 版本，上游更改被忽略
[PRESERVE]
packages/ui/src/components/layout/StatusBar.tsx
packages/ui/src/components/chat/ChatScrollMarkers.tsx
packages/ui/src/components/sections/layout/LayoutPage.tsx

# [MERGE_SAFE] - 自动合并，冲突时保留 fork
[MERGE_SAFE]
packages/ui/src/stores/useUIStore.*
packages/ui/src/stores/useNotificationStore.*
packages/ui/src/sync/session-actions.*
packages/ui/src/lib/i18n/messages/*.ts
packages/ui/src/lib/i18n/messages/*.settings.ts

# [STREAM] - 直接使用上游版本（不保护）
[STREAM]
packages/desktop/src-tauri/
packages/vscode/
```

- `[PRESERVE]`：上游任何更改都不合并，完全保留 fork
- `[MERGE_SAFE]`：尝试合并，冲突时用 fork 版本
- `[STREAM]`：直接用上游版本覆盖

#### 3. GitHub Actions 增强

- 在 sync-upstream.yml 的失败步骤中添加 `workflow_dispatch` 的 `repository_dispatch` 或 Issue 创建
- 使用 `actions/github-script@v7` 创建 Issue，标题格式：`[Auto] Upstream sync conflict - {date}`
- Issue 内容包含：
  - 冲突文件列表及各自的变更摘要
  - 推荐的解决步骤
  - 引用 `prompts/merge-upstream.md` 提示词
- 添加同步结果的 Job Summary 输出

#### 4. 增加 PowerShell 脚本（Windows 兼容）

重写 `scripts/sync-upstream.ps1`，与 `.sh` 版本功能等价：

```powershell
# 用法: .\scripts\sync-upstream.ps1
# 功能:
#   1. 检查 upstream remote 是否存在，不存在则添加
#   2. fetch upstream --tags --prune
#   3. 检测最新 tag 或 main 的 SHA
#   4. 检查是否已同步
#   5. 创建 sync 分支 sync/upstream-<ref>-<sha>
#   6. 尝试 merge，处理保护路径
#   7. 推送到 origin，创建 PR（如果 gh CLI 可用）
```

#### 5. 完善 prompts/merge-upstream.md

- 增加 PowerShell 版的命令示例（当前只有 bash）
- 简化 AI 处理步骤：强调先读取 `git diff --name-only` 结果，再逐文件决定策略
- 增加失败回滚命令：`git merge --abort`

---

## 实现检查清单

- [ ] 修改 `scripts/merge-with-backup.sh` 合并策略（`--no-commit` + 保护路径逐个处理）
- [ ] 创建 `scripts/sync-upstream.ps1` — PowerShell 版本
- [ ] 升级 `.github/sync-config/protected-paths.txt` 为三段式分类
- [ ] 修改 `.github/workflows/sync-upstream.yml` — 新策略 + 冲突 Issue + Job Summary
- [ ] 更新 `docs/SYNC.md` — 反映新的合并策略和 PowerShell 脚本
- [ ] 更新 `prompts/merge-upstream.md` — 增加 PowerShell 示例，精简流程
- [ ] 验证：在 fork 仓库执行一次 `.\scripts\sync-upstream.ps1` 测试同步流程
- [ ] 验证：手动造一个冲突场景，确认保护路径正确处理
