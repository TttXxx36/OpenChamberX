#!/usr/bin/env bash
# ============================================================
# OpenChamberX 本地同步脚本
# ============================================================
# 当 GitHub Actions 不可用 / 想本地调试时使用。
# 用法：
#   ./scripts/sync-upstream.sh                 # 同步最新 tag
#   ./scripts/sync-upstream.sh v1.13.0         # 同步指定 tag
#   ./scripts/sync-upstream.sh 024834fc        # 同步指定 commit
#   ./scripts/sync-upstream.sh main            # 同步 main 分支
# ============================================================
set -euo pipefail

# ---------- 参数解析 ----------
UPSTREAM_OWNER="${UPSTREAM_OWNER:-openchamber}"
UPSTREAM_REPO="${UPSTREAM_REPO:-openchamber}"
FORK_REMOTE="${FORK_REMOTE:-origin}"
TARGET_REF="${1:-}"

# ---------- 颜色 ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${BLUE}[sync]${NC} $*"; }
ok()    { echo -e "${GREEN}[ok]${NC} $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC} $*"; }
err()   { echo -e "${RED}[err]${NC} $*" >&2; }

# ---------- 前置检查 ----------
command -v git >/dev/null || { err "git not found"; exit 1; }
command -v bun >/dev/null || warn "bun not found, you may need to run 'bun install' manually"

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# ---------- 1. 确保 upstream remote ----------
if ! git remote get-url upstream >/dev/null 2>&1; then
  log "Adding upstream remote: https://github.com/${UPSTREAM_OWNER}/${UPSTREAM_REPO}.git"
  git remote add upstream "https://github.com/${UPSTREAM_OWNER}/${UPSTREAM_REPO}.git"
fi

log "Fetching upstream..."
git fetch upstream --tags --force --prune --prune-tags

# ---------- 2. 决定目标 ref ----------
if [ -z "$TARGET_REF" ]; then
  TARGET_REF=$(git tag -l 'v*' --sort=-version:refname | head -n 1)
  if [ -z "$TARGET_REF" ]; then
    TARGET_REF="main"
  fi
  log "Auto-detected latest target: $TARGET_REF"
else
  log "Manual target: $TARGET_REF"
fi

TARGET_SHA=$(git rev-parse "upstream/${TARGET_REF}^{commit}" 2>/dev/null \
  || git rev-parse "upstream/${TARGET_REF}" 2>/dev/null \
  || { err "Cannot resolve upstream/${TARGET_REF}"; exit 1; })
SHORT_SHA="${TARGET_SHA:0:7}"
ok "Targeting upstream/${TARGET_REF} @ ${SHORT_SHA}"

# ---------- 3. 检查是否已同步 ----------
if git merge-base --is-ancestor "$TARGET_SHA" main; then
  ok "main already contains $TARGET_SHA — nothing to do"
  exit 0
fi

BEHIND=$(git rev-list --count main.."$TARGET_SHA")
AHEAD=$(git rev-list --count "$TARGET_SHA"..main)
log "main is $BEHIND commits behind upstream, $AHEAD commits ahead"

# ---------- 4. 加载保护路径 ----------
PROTECTED_FILE=".github/sync-config/protected-paths.txt"
PROTECTED_ARGS=()
if [ -f "$PROTECTED_FILE" ]; then
  log "Loading protected paths from $PROTECTED_FILE"
  while IFS= read -r line; do
    # 跳过空行与注释
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    # 转换为本地的"保留"参数
    # 这里仅打印提示，实际策略通过 merge -X ours 实现
    PROTECTED_ARGS+=("$line")
    log "  protected: $line"
  done < "$PROTECTED_FILE"
else
  warn "No $PROTECTED_FILE found, no protected paths"
fi

# ---------- 5. 创建同步分支 ----------
BRANCH="sync/upstream-${TARGET_REF}-${SHORT_SHA}"
log "Creating branch: $BRANCH"
git checkout -b "$BRANCH" main

# ---------- 6. 尝试合并 ----------
log "Attempting merge (strategy: recursive_ours)..."
COMMIT_MSG="chore(sync): merge upstream ${TARGET_REF} (${SHORT_SHA}) into fork

Strategy: recursive_ours
Upstream commit: $TARGET_SHA
Preserved regions: see .github/sync-config/protected-paths.txt

Co-authored-by: openchamber upstream <noreply@github.com>"

if git merge --no-ff -X ours -m "$COMMIT_MSG" "$TARGET_SHA"; then
  ok "Merge succeeded"
else
  warn "Merge has conflicts. Conflicting files:"
  git diff --name-only --diff-filter=U | sed 's/^/  - /'
  echo ""
  echo "Next steps:"
  echo "  1. Resolve conflicts manually"
  echo "  2. git add ."
  echo "  3. git commit -m 'fix: resolve sync conflicts'"
  echo "  4. git push -u ${FORK_REMOTE} $BRANCH"
  echo "  5. Open a PR on GitHub"
  exit 2
fi

# ---------- 7. 显示差异统计 ----------
log "Diff stats vs main (before merge):"
git diff --stat HEAD~1 HEAD | tail -1
log "Files changed:"
git diff --name-only HEAD~1 HEAD | sed 's/^/  - /'

# ---------- 8. 询问是否推送 ----------
echo ""
read -rp "$(echo -e "${YELLOW}[sync]${NC} Push branch '$BRANCH' to ${FORK_REMOTE}? [y/N] ")" PUSH
if [[ "$PUSH" =~ ^[Yy]$ ]]; then
  log "Pushing..."
  git push -u "$FORK_REMOTE" "$BRANCH"
  ok "Branch pushed. Open a PR on GitHub."
else
  warn "Branch NOT pushed. Run manually: git push -u $FORK_REMOTE $BRANCH"
fi

ok "Done. Branch: $BRANCH"
