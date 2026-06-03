# OpenChamberX 上游同步工具包

> 用于将 [`openchamber/openchamber`](https://github.com/openchamber/openchamber) 上游的代码变更**自动、持续、可控**地同步到 [`TttXxx36/OpenChamberX`](https://github.com/TttXxx36/OpenChamberX) fork，同时完整保留 fork 的自定义功能与重构。

## 包含内容

```
openchamberx-sync-toolkit/
├── README.md                                # 本文件
├── prompts/
│   └── merge-upstream.md                    # AI 合并提示词（手动精细合并用）
├── .github/
│   ├── workflows/
│   │   └── sync-upstream.yml                # 自动化 GitHub Action
│   └── sync-config/
│       └── protected-paths.txt              # 保护路径配置
├── scripts/
│   └── sync-upstream.sh                     # 本地同步脚本
└── docs/
    └── SYNC.md                              # 详细同步策略文档
```

## 三层同步方案

| 层级 | 触发方式 | 用途 | 何时用 |
|------|----------|------|--------|
| **Layer 1: GitHub Actions** | 每天 UTC 06:00 / 手动 | 自动检测上游更新、开 PR | 默认方式，覆盖 90% 场景 |
| **Layer 2: 冲突 Issue** | 合并失败时自动 | 列出冲突文件、提示人工 | 当上游有大改动时 |
| **Layer 3: AI 提示词** | 手动 | 精细控制每个 commit 的合并 | 复杂冲突或重要升级 |

## 5 分钟上手

### 1. 安装到 fork 仓库

```bash
# 假设已 clone OpenChamberX
cd /path/to/OpenChamberX

# 复制整个工具包
cp -r /path/to/openchamberx-sync-toolkit/{prompts,.github,scripts,docs} .

# 提交并推送
git add . && git commit -m "chore: add upstream sync toolkit"
git push origin main
```

### 2. 触发第一次同步

1. 打开 `https://github.com/TttXxx36/OpenChamberX/actions`
2. 选择 **"Sync Upstream"** workflow
3. 点击 **"Run workflow"** → 选 `strategy: recursive_ours` → 点击绿色按钮
4. 等待 1-2 分钟，workflow 会：
   - 找到上游最新 tag (v1.12.0)
   - 尝试合并到 fork
   - 成功 → 开 PR 等你 review
   - 失败 → 开 Issue 列出冲突文件

### 3. 处理 PR

打开自动开的 PR，按 `docs/SYNC.md` 第 7 节的清单逐项验证，确认无误后 Merge。

## 保护路径（保留区）

默认已配置好的保护范围（你可以编辑 `.github/sync-config/protected-paths.txt` 调整）：

- ✅ **8 个 GitHub Actions workflow** — fork 独有
- ✅ **6 个 package.json + bun.lock** — 自定义依赖
- ✅ **useUIStore / useNotificationStore / formatSdkError / event-reducer** — 核心重构
- ✅ **Electron main/preload** — 安全网
- ✅ **i18n 7 语言** — sessionRename 扩展
- ✅ **README / CHANGELOG / AGENTS** — 自定义文档
- ✅ **`.agents/`** — 显式排除（fork 已删除，不拉回）
- ✅ **`.codegraph/`** — 用户本地工具

## AI 合并提示词用法

当 GitHub Action 自动合并出现无法解决的冲突，或你想精细控制某个 release 的合并时：

1. 打开 `prompts/merge-upstream.md`
2. 整段复制给 AI（Claude / GPT / Cursor）
3. 在最后追加变更包：
   - "请把上游 v1.12.0 合并到我的 fork"
   - "请把上游 commit `024834fc...` 合并到我的 fork"
   - "请把上游 PR #2 合并到我的 fork"
4. AI 会按"保留区优先"原则给出合并建议

## 本地同步脚本

```bash
chmod +x scripts/sync-upstream.sh

./scripts/sync-upstream.sh              # 同步最新 tag
./scripts/sync-upstream.sh v1.13.0      # 同步指定 tag
./scripts/sync-upstream.sh 024834fc     # 同步指定 commit
./scripts/sync-upstream.sh main         # 同步 main 分支
```

脚本行为与 GitHub Action 一致：
- 自动检测冲突
- 保护路径优先
- 推送前确认
- 不开 PR（推到分支后人工开）

## 工作原理（高级）

### 同步流程图

```
                   ┌─────────────────────┐
                   │ Upstream Release vX │
                   │ (openchamber main)  │
                   └──────────┬──────────┘
                              │
                              ▼  (每天 06:00 / 手动)
                   ┌─────────────────────┐
                   │  GitHub Action 触发  │
                   │  (sync-upstream.yml)│
                   └──────────┬──────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │ git fetch upstream  │
                   │ 检测最新 tag/commit │
                   └──────────┬──────────┘
                              │
                              ▼
                ┌─────────────────────────────┐
                │ 已在 main? → 退出            │
                │ 不在 → 继续                  │
                └──────────┬──────────────────┘
                           ▼
                ┌─────────────────────────────┐
                │ 切到 sync/upstream-<ref>-<sha> │
                │ 执行 git merge -X ours        │
                │ (冲突默认采用 fork)            │
                └──────────┬──────────────────┘
                           │
                ┌──────────┴──────────┐
                ▼                     ▼
        ┌──────────────┐    ┌──────────────────┐
        │ 合并成功      │    │ 合并失败（冲突）   │
        │ push + 开 PR  │    │ 开 Issue 提示     │
        └──────┬───────┘    └────────┬─────────┘
               ▼                    ▼
        ┌──────────────┐    ┌──────────────────┐
        │人工 review   │    │ 用 prompts 提示词 │
        │验证后 merge  │    │ 手动解决冲突      │
        └──────────────┘    └──────────────────┘
```

## 配置项

### 必选
- 默认配置即可用，无需任何环境变量

### 可选
- 调整 `.github/sync-config/protected-paths.txt` 增删保护路径
- 编辑 `.github/workflows/sync-upstream.yml` 中的 cron 表达式调整自动检查频率

### cron 表达式参考
- `'0 6 * * *'` —— 每天 UTC 06:00（北京 14:00）
- `'0 */6 * * *'` —— 每 6 小时
- `'0 6 * * 1'` —— 每周一 UTC 06:00
- `''` —— 禁用定时，只手动触发

## 关键原则

1. **保留区优先**：保护路径永远采用 fork 版本
2. **不复制 lock 文件**：`bun.lock` 合并后必须 `bun install` 重新生成
3. **历史保留**：用 `git merge --no-ff`，不要 `git rebase`
4. **不引入 Tauri**：fork 无 Tauri，遇到 Tauri 变更一律拒绝
5. **错误处理不弱化**：fork 改成了 throw on error，不要回退到 silent error

## 故障排查

| 现象 | 原因 | 解决 |
|------|------|------|
| workflow 没跑 | cron 还没到 / 没启用 | Actions → 启用 workflow |
| 提示 "Permission denied" | 默认 GITHUB_TOKEN 权限不足 | 仓库 Settings → Actions → Workflow permissions → 选 "Read and write permissions" |
| 提示 "Cannot resolve upstream" | upstream remote 没加 | 检查 `git remote -v` |
| 提示 "Merge has conflicts" | 上游与 fork 都有改动 | 看自动开的 Issue 里的冲突列表 |
| 推送失败 | 分支保护规则 | Settings → Branches → 允许 bot 推送 |

## 扩展阅读

- [`docs/SYNC.md`](docs/SYNC.md) —— 详细同步策略、上游重大变更处理手册
- [`prompts/merge-upstream.md`](prompts/merge-upstream.md) —— AI 合并提示词完整版（手动精细合并用）

## 维护

- **每周**：检查 PR 通知
- **每月**：review `protected-paths.txt`
- **每季度**：评估 fork 维护成本（与上游分歧度）
