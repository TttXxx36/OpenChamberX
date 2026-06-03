#!/usr/bin/env bash
# ============================================================
# OpenChamberX 一键合并脚本（带备份 + PR）
# ============================================================
# 完整执行：tag 备份 → 切临时分支 → 合并 → 验证 → 推分支 → 开 PR
#
# 用法：
#   ./scripts/merge-with-backup.sh                        # 同步最新上游 tag
#   ./scripts/merge-with-backup.sh v1.13.0                # 同步指定 tag
#   ./scripts/merge-with-backup.sh 024834fc               # 同步指定 commit
#   ./scripts/merge-with-backup.sh main                    # 同步 main 分支
#   DRY_RUN=1 ./scripts/merge-with-backup.sh v1.13.0      # 只看，不改
#
# 前置依赖：git、bun、gh（GitHub CLI，已认证）
# ============================================================
set -euo pipefail

# ---------- 配置 ----------
UPSTREAM_OWNER="${UPSTREAM_OWNER:-openchamber}"
UPSTREAM_REPO="${UPSTREAM_REPO:-openchamber}"
UPSTREAM_URL="https://github.com/${UPSTREAM_OWNER}/${UPSTREAM_REPO}.git"
FORK_REMOTE="${FORK_REMOTE:-origin}"
STRATEGY="${STRATEGY:-recursive_ours}"   # recursive_ours | recursive_theirs | ort
DRY_RUN="${DRY_RUN:-0}"
SKIP_TESTS="${SKIP_TESTS:-0}"
SKIP_PR="${SKIP_PR:-0}"
AUTO_PUSH="${AUTO_PUSH:-0}"              # 默认不推，需明确开启

# ---------- 颜色 ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${BLUE}[merge]${NC} $*"; }
ok()    { echo -e "${GREEN}[ok]${NC} $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC} $*"; }
err()   { echo -e "${RED}[err]${NC} $*" >&2; }
step()  { echo -e "\n${YELLOW}━━━ $* ━━━${NC}"; }

# ---------- 前置检查 ----------
command -v git >/dev/null || { err "git not found"; exit 1; }
command -v gh >/dev/null 2>&1 || warn "gh CLI not found, will skip PR creation"

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# ---------- 参数解析 ----------
TARGET_REF="${1:-}"

# ============================================================
# 阶段 1：备份（tag + branch 双重保险）
# ============================================================
step "阶段 1/5：备份 main 分支"

# 1.1 拉取最新 main
log "→ 拉取最新 main..."
git fetch "$FORK_REMOTE" main
MAIN_SHA=$(git rev-parse "$FORK_REMOTE/main")
ok "当前 main: ${MAIN_SHA:0:7}"

# 1.2 准备命名
DATE=$(date +%Y%m%d)
TIME=$(date +%H%M%S)
if [ -z "$TARGET_REF" ]; then
  # 暂存一个占位，等阶段 2 拿到上游信息后回填
  BACKUP_TAG="backup/pre-merge-pending-${DATE}-${TIME}"
  BACKUP_BRANCH="backup/pre-merge-pending-${DATE}-${TIME}"
else
  # 用用户指定的 ref 作为命名后缀
  SAFE_REF=$(echo "$TARGET_REF" | tr '/' '-' | tr -c '[:alnum:].-' '-')
  BACKUP_TAG="backup/pre-merge-${SAFE_REF}-${DATE}-${TIME}"
  BACKUP_BRANCH="backup/pre-merge-${SAFE_REF}-${DATE}-${TIME}"
fi

# 1.3 确认工作区干净
if ! git diff --quiet 2>/dev/null; then
  err "工作区有未提交修改，请先 commit 或 stash"
  git status --short
  exit 1
fi
ok "工作区干净"

# 1.4 创建备份
if [ "$DRY_RUN" = "1" ]; then
  warn "[DRY-RUN] 跳过创建 tag/branch"
else
  log "→ 创建备份 tag: $BACKUP_TAG"
  git tag -a "$BACKUP_TAG" "$MAIN_SHA" \
    -m "Backup before merging upstream $TARGET_REF

Main HEAD: $MAIN_SHA
Date: $DATE $TIME
This tag is immutable. Use to rollback if merge fails."

  log "→ 创建备份 branch: $BACKUP_BRANCH"
  git branch "$BACKUP_BRANCH" "$MAIN_SHA"

  log "→ 推送到远端..."
  git push "$FORK_REMOTE" "$BACKUP_TAG" || err "推送 tag 失败"
  git push "$FORK_REMOTE" "$BACKUP_BRANCH" || err "推送 branch 失败"
fi

# 1.5 验证
if [ "$DRY_RUN" = "1" ]; then
  warn "[DRY-RUN] 备份步骤跳过"
else
  git ls-remote "$FORK_REMOTE" | grep -E "($BACKUP_TAG|$BACKUP_BRANCH)" || \
    { err "远端未找到备份，请检查"; exit 1; }
  ok "✓ 备份完成"
  echo "  tag:    $BACKUP_TAG"
  echo "  branch: $BACKUP_BRANCH"
fi

# ============================================================
# 阶段 2：准备上游与目标
# ============================================================
step "阶段 2/5：解析上游目标"

# 2.1 配置 upstream remote
if ! git remote get-url upstream >/dev/null 2>&1; then
  log "→ 添加 upstream remote"
  git remote add upstream "$UPSTREAM_URL"
fi
git fetch upstream --tags --force --prune --prune-tags

# 2.2 决定目标 ref
if [ -z "$TARGET_REF" ]; then
  TARGET_REF=$(git tag -l 'v*' --sort=-version:refname | head -n 1)
  if [ -z "$TARGET_REF" ]; then
    TARGET_REF="main"
  fi
  log "→ 自动选择最新 tag: $TARGET_REF"
else
  log "→ 使用指定目标: $TARGET_REF"
fi

# 2.3 解析为 commit SHA
TARGET_SHA=$(git rev-parse "upstream/${TARGET_REF}^{commit}" 2>/dev/null \
  || git rev-parse "upstream/${TARGET_REF}" 2>/dev/null \
  || { err "无法解析 upstream/${TARGET_REF}"; exit 1; })
SHORT_SHA="${TARGET_SHA:0:7}"
ok "目标: upstream/${TARGET_REF} @ ${SHORT_SHA}"

# 2.4 回填 tag 名称（如果阶段 1 是 pending）
if [[ "$BACKUP_TAG" == *"pending"* ]]; then
  SAFE_REF=$(echo "$TARGET_REF" | tr '/' '-' | tr -c '[:alnum:].-' '-')
  NEW_TAG="backup/pre-merge-${SAFE_REF}-${DATE}-${TIME}"
  if [ "$DRY_RUN" != "1" ]; then
    log "→ 重命名备份 tag: $BACKUP_TAG → $NEW_TAG"
    git tag "$NEW_TAG" "$BACKUP_TAG" -m "$(git tag -n10 $BACKUP_TAG | tail -n +2)"
    git tag -d "$BACKUP_TAG"
    git push "$FORK_REMOTE" ":refs/tags/$BACKUP_TAG" || true
    git push "$FORK_REMOTE" "$NEW_TAG"
  fi
  BACKUP_TAG="$NEW_TAG"
fi

# 2.5 检查是否已同步
if git merge-base --is-ancestor "$TARGET_SHA" "$FORK_REMOTE/main"; then
  warn "main 已包含 $SHORT_SHA，无需同步"
  exit 0
fi
BEHIND=$(git rev-list --count "$FORK_REMOTE/main..$TARGET_SHA")
AHEAD=$(git rev-list --count "$TARGET_SHA..$FORK_REMOTE/main")
log "→ 落后 $BEHIND commit, 领先 $AHEAD commit"

# ============================================================
# 阶段 3：执行合并
# ============================================================
step "阶段 3/5：在临时分支执行合并"

SYNC_BRANCH="sync/upstream-${TARGET_REF//\//-}-${SHORT_SHA}"
log "→ 切换到: $SYNC_BRANCH"

# 3.1 切到临时分支（基于最新 main）
if git show-ref --verify --quiet "refs/heads/$SYNC_BRANCH"; then
  warn "本地分支 $SYNC_BRANCH 已存在，删除后重建"
  git branch -D "$SYNC_BRANCH"
fi
git checkout -b "$SYNC_BRANCH" "$FORK_REMOTE/main"

# 3.2 加载保护路径
PROTECTED_FILE=".github/sync-config/protected-paths.txt"
PROTECTED_LIST=()
if [ -f "$PROTECTED_FILE" ]; then
  log "→ 加载保留区: $PROTECTED_FILE"
  while IFS= read -r line; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    PROTECTED_LIST+=("$line")
  done < "$PROTECTED_FILE"
  ok "已保护 ${#PROTECTED_LIST[@]} 个路径"
else
  warn "无 $PROTECTED_FILE，使用空保护列表"
fi

# 3.3 执行合并
COMMIT_MSG="chore(sync): merge upstream ${TARGET_REF} (${SHORT_SHA}) into fork

Strategy: $STRATEGY
Upstream commit: $TARGET_SHA
Backed up to tag: $BACKUP_TAG
Protected paths: see .github/sync-config/protected-paths.txt
AI analysis: see prompts/merge-upstream.md

Co-authored-by: openchamber upstream <noreply@github.com>"

case "$STRATEGY" in
  recursive_ours)   MERGE_OPTS=(--no-ff -X ours) ;;
  recursive_theirs) MERGE_OPTS=(--no-ff -X theirs) ;;
  ort)              MERGE_OPTS=(--no-ff) ;;
  *)                MERGE_OPTS=(--no-ff -X ours) ;;
esac

log "→ 运行: git merge ${MERGE_OPTS[*]} $TARGET_SHA"
if [ "$DRY_RUN" = "1" ]; then
  warn "[DRY-RUN] 跳过实际合并"
else
  if ! git merge "${MERGE_OPTS[@]}" -m "$COMMIT_MSG" "$TARGET_SHA"; then
    CONFLICT_COUNT=$(git diff --name-only --diff-filter=U | wc -l)
    err "✗ 合并失败：$CONFLICT_COUNT 个冲突文件"
    git diff --name-only --diff-filter=U | sed 's/^/  - /'

    cat <<EOF

${YELLOW}━━━ 冲突解决指引 ━━━${NC}

1. ${BLUE}用 AI 辅助分析冲突${NC}（推荐）：
   - 打开 prompts/merge-upstream.md
   - 整段发给 Claude/GPT
   - 附加: "请帮我解决合并冲突，冲突版本: $TARGET_REF"

2. ${BLUE}手动解决${NC}：
   - 编辑每个冲突文件（搜索 <<<<<<< HEAD 标记）
   - git add <file>
   - git commit -m "fix: resolve sync conflicts"

3. ${BLUE}放弃此次合并${NC}（保留备份，回 main）：
   - git merge --abort
   - git checkout main
   - git branch -D $SYNC_BRANCH
   - 备份仍在: $BACKUP_TAG

EOF
    exit 2
  fi
  ok "✓ 合并成功"
fi

# 3.4 重新生成 lock（关键！禁止 cp 上游的）
if [ "$DRY_RUN" != "1" ] && [ -f "package.json" ] && [ "$SKIP_TESTS" != "1" ]; then
  if command -v bun >/dev/null; then
    log "→ 重新生成 bun.lock..."
    rm -f bun.lock bun.lockb
    bun install
    if ! git diff --quiet bun.lock bun.lockb 2>/dev/null; then
      log "  lock 文件有变更，追加到当前 commit"
      git add bun.lock bun.lockb 2>/dev/null || true
      git commit --amend --no-edit
    fi
  else
    warn "bun 未安装，跳过 lock 重生成（请手动运行 bun install）"
  fi
fi

# ============================================================
# 阶段 4：验证
# ============================================================
step "阶段 4/5：验证合并结果"

if [ "$DRY_RUN" = "1" ]; then
  warn "[DRY-RUN] 跳过验证"
elif [ "$SKIP_TESTS" = "1" ]; then
  warn "跳过测试（SKIP_TESTS=1）"
else
  CHECK_FAILED=0
  # 4.1 typecheck
  if grep -q '"typecheck"' package.json 2>/dev/null; then
    log "→ 运行 typecheck..."
    if bun run typecheck; then
      ok "  ✓ typecheck 通过"
    else
      err "  ✗ typecheck 失败"
      CHECK_FAILED=1
    fi
  fi

  # 4.2 test
  if grep -q '"test"' package.json 2>/dev/null; then
    log "→ 运行 test..."
    if bun run test; then
      ok "  ✓ test 通过"
    else
      err "  ✗ test 失败"
      CHECK_FAILED=1
    fi
  fi

  # 4.3 build
  if grep -q '"build:package"' package.json 2>/dev/null; then
    log "→ 运行 build..."
    if bun run build:package; then
      ok "  ✓ build 成功"
    else
      err "  ✗ build 失败"
      CHECK_FAILED=1
    fi
  fi

  # 4.4 保留区完整性
  log "→ 检查保留区未被覆盖..."
  VIOLATIONS=0
  for path in "${PROTECTED_LIST[@]}"; do
    if [ -f "$path" ] || [ -d "$path" ]; then
      # 检查是否被合并改了（仅对具体文件检查）
      if [ -f "$path" ] && git diff --name-only "main..HEAD" | grep -qx "$path"; then
        if ! git diff --quiet "main..HEAD" -- "$path"; then
          warn "  ⚠ $path 在合并中被修改，请确认是否预期"
          VIOLATIONS=$((VIOLATIONS+1))
        fi
      fi
    fi
  done
  if [ "$VIOLATIONS" -eq 0 ]; then
    ok "  ✓ 保留区完整"
  fi

  if [ "$CHECK_FAILED" -ne 0 ]; then
    err "✗ 验证失败，合并已停在本地分支 $SYNC_BRANCH"
    err "  请修复后: git commit --amend 或手动修复"
    err "  备份在: $BACKUP_TAG"
    exit 3
  fi
  ok "✓ 全部验证通过"
fi

# ============================================================
# 阶段 5：推送 & 开 PR
# ============================================================
step "阶段 5/5：推送与开 PR"

# 5.1 推送分支
if [ "$DRY_RUN" = "1" ]; then
  warn "[DRY-RUN] 跳过推送"
elif [ "$AUTO_PUSH" = "1" ]; then
  log "→ 推送 $SYNC_BRANCH..."
  git push -u "$FORK_REMOTE" "$SYNC_BRANCH"
  ok "  ✓ 已推送"
else
  warn "未自动推送（AUTO_PUSH=0），需要你确认"
  read -rp "  推送 $SYNC_BRANCH 到 $FORK_REMOTE? [y/N] " PUSH
  if [[ "$PUSH" =~ ^[Yy]$ ]]; then
    git push -u "$FORK_REMOTE" "$SYNC_BRANCH"
    ok "  ✓ 已推送"
  else
    warn "  跳过推送，分支仅在本地: $SYNC_BRANCH"
    PUSHED=0
  fi
fi

# 5.2 开 PR
if [ "$DRY_RUN" = "1" ] || [ "$SKIP_PR" = "1" ]; then
  warn "跳过开 PR"
elif ! command -v gh >/dev/null 2>&1; then
  warn "gh CLI 未安装，请手动在 GitHub 网页开 PR"
elif [ "${PUSHED:-1}" = "0" ]; then
  warn "未推送，不开 PR"
else
  log "→ 检查是否已有 PR..."
  EXISTING=$(gh pr list --head "$SYNC_BRANCH" --state open --json number -q '.[0].number' 2>/dev/null || echo "")

  if [ -n "$EXISTING" ]; then
    ok "  PR 已存在: #$EXISTING"
    gh pr view "$EXISTING" --json url -q '.url'
  else
    log "→ 开 PR..."
    PR_BODY="## 🔄 上游自动同步 PR

**目标**: \`openchamber/openchamber@${TARGET_REF}\` (${SHORT_SHA})
**落后 commit**: $BEHIND
**策略**: \`$STRATEGY\`
**备份 tag**: \`${BACKUP_TAG}\`

### 操作清单
- [ ] \`bun install && bun run typecheck && bun run test\`
- [ ] \`bun run build:package\`
- [ ] 验证 8 个 GitHub Actions workflow 仍工作
- [ ] \`useUIStore\` deprecation 警告不破坏构建
- [ ] Electron 启动失败对话框测试
- [ ] 多语言 7 语言 i18n 键未缺失

### 回滚（如需）
\`\`\`bash
git checkout main
git revert -m 1 <sync-merge-commit-sha>
git push origin main
\`\`\`

### 参考
- 同步策略: docs/SYNC.md
- AI 提示词: prompts/merge-upstream.md
- 保护路径: .github/sync-config/protected-paths.txt

---
_由 merge-with-backup.sh 自动生成_"

    gh pr create \
      --title "🔄 chore(sync): merge upstream ${TARGET_REF}" \
      --body "$PR_BODY" \
      --base main \
      --head "$SYNC_BRANCH" \
      || warn "开 PR 失败，请手动在 GitHub 网页操作"
  fi
fi

# ============================================================
# 总结
# ============================================================
step "✅ 全部完成"

cat <<EOF
  分支:       $SYNC_BRANCH
  备份 tag:   $BACKUP_TAG
  备份 branch: $BACKUP_BRANCH
  合并策略:   $STRATEGY
  落后/领先:  $BEHIND / $AHEAD

EOF

if [ "$DRY_RUN" = "1" ]; then
  warn "本次为 DRY-RUN，未做实际修改"
fi
