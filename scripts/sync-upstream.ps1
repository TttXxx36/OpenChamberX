#!/usr/bin/env pwsh
# ============================================================
# OpenChamberX 本地同步脚本（PowerShell）
# ============================================================
# 用法:
#   .\scripts\sync-upstream.ps1                  # 同步最新 tag
#   .\scripts\sync-upstream.ps1 -Ref v1.13.0     # 同步指定 tag
#   .\scripts\sync-upstream.ps1 -Ref 024834fc    # 同步指定 commit
#   .\scripts\sync-upstream.ps1 -Ref main        # 同步 main 分支
#   .\scripts\sync-upstream.ps1 -DryRun          # 试跑，不实际合并
# ============================================================

param(
  [string]$Ref = "",
  [switch]$DryRun
)

$UPSTREAM_OWNER = "openchamber"
$UPSTREAM_REPO = "openchamber"
$FORK_REMOTE = "origin"
$PROTECTED_FILE = ".github/sync-config/protected-paths.txt"

$REPO_ROOT = git rev-parse --show-toplevel
Set-Location $REPO_ROOT

function log  { Write-Host "[sync]" -ForegroundColor Blue -NoNewline; Write-Host " $args" }
function ok   { Write-Host "[ok]" -ForegroundColor Green -NoNewline; Write-Host " $args" }
function warn { Write-Host "[warn]" -ForegroundColor Yellow -NoNewline; Write-Host " $args" }
function err  { Write-Host "[err]" -ForegroundColor Red -NoNewline; Write-Host " $args" }

# ---------- 1. 确保 upstream remote ----------
$remoteList = git remote
if (-not ($remoteList -contains "upstream")) {
  log "Adding upstream remote: https://github.com/${UPSTREAM_OWNER}/${UPSTREAM_REPO}.git"
  git remote add upstream "https://github.com/${UPSTREAM_OWNER}/${UPSTREAM_REPO}.git"
}

log "Fetching upstream..."
git fetch upstream --tags --force --prune --prune-tags

# ---------- 2. 决定目标 ref ----------
if (-not $Ref) {
  $Ref = git tag -l 'v*' --sort=-version:refname | Select-Object -First 1
  if (-not $Ref) { $Ref = "main" }
  log "Auto-detected latest target: $Ref"
} else {
  log "Manual target: $Ref"
}

# 解析 SHA
$TARGET_SHA = $null
$resolveAttempts = @(
  "refs/tags/${Ref}^{commit}",
  "refs/tags/${Ref}",
  "v${Ref#v}^{commit}",
  "${Ref}^{commit}",
  "${Ref}",
  "upstream/${Ref}^{commit}",
  "upstream/${Ref}"
)
foreach ($attempt in $resolveAttempts) {
  $sha = git rev-parse $attempt 2>$null
  if ($sha) { $TARGET_SHA = $sha; break }
}
if (-not $TARGET_SHA) { err "Cannot resolve $Ref"; exit 1 }

$SHORT_SHA = $TARGET_SHA.Substring(0, 7)
ok "Targeting $Ref @ $SHORT_SHA"

# ---------- 3. 检查是否已同步 ----------
$isAncestor = git merge-base --is-ancestor $TARGET_SHA main 2>$null
if ($LASTEXITCODE -eq 0) {
  ok "main already contains $TARGET_SHA - nothing to do"
  exit 0
}

$BEHIND = git rev-list --count main..$TARGET_SHA
$AHEAD = git rev-list --count $TARGET_SHA..main
log "main is $BEHIND commits behind upstream, $AHEAD commits ahead"

# ---------- 4. 加载保护路径（三段式） ----------
$preservePaths = @()
$mergeSafePaths = @()
$streamPaths = @()
$currentSection = ""

if (Test-Path $PROTECTED_FILE) {
  log "Loading protected paths from $PROTECTED_FILE"
  foreach ($line in Get-Content $PROTECTED_FILE) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
    if ($trimmed -eq "[PRESERVE]")  { $currentSection = "preserve"; continue }
    if ($trimmed -eq "[MERGE_SAFE]") { $currentSection = "mergesafe"; continue }
    if ($trimmed -eq "[STREAM]")    { $currentSection = "stream"; continue }
    switch ($currentSection) {
      "preserve"  { $preservePaths += $trimmed }
      "mergesafe" { $mergeSafePaths += $trimmed }
      "stream"    { $streamPaths += $trimmed }
    }
  }
  log "  [PRESERVE] $($preservePaths.Count) paths"
  log "  [MERGE_SAFE] $($mergeSafePaths.Count) paths"
  log "  [STREAM] $($streamPaths.Count) paths"
} else {
  warn "No $PROTECTED_FILE found, no protected paths"
}

# ---------- 5. 创建同步分支 ----------
$BRANCH = "sync/upstream-${Ref}-${SHORT_SHA}"
log "Creating branch: $BRANCH"
git checkout -b $BRANCH main

if ($DryRun) {
  warn "DryRun mode: stopping before merge"
  warn "Would merge upstream/$Ref ($SHORT_SHA) into $BRANCH"
  warn "To clean up: git checkout main; git branch -D $BRANCH"
  exit 0
}

# ---------- 6. 带策略的合并 ----------
log "Attempting merge (--no-commit + protected-path handling)..."

$COMMIT_MSG = "chore(sync): merge upstream $Ref ($SHORT_SHA) into fork

Strategy: --no-commit with protected-path handling
Upstream commit: $TARGET_SHA
Preserved regions: see .github/sync-config/protected-paths.txt

Co-authored-by: openchamber upstream <noreply@github.com>"

git merge --no-ff --no-commit $TARGET_SHA
$mergeExit = $LASTEXITCODE

if ($mergeExit -ne 0) {
  warn "Merge has conflicts. Checking protected paths..."
}

# 检查冲突文件
$conflicted = @()
if (Test-Path ".git/MERGE_MSG") {
  # merge 正在进行（有冲突或无冲突的 --no-commit）
  $conflicted = git diff --name-only --diff-filter=U
}

# 处理 [STREAM] 文件：用上游版本
foreach ($pattern in $streamPaths) {
  $files = git diff --name-only --diff-filter=U 2>$null
  foreach ($file in $files) {
    if ($file -like $pattern.Replace("/packages/*/", "packages/*/").Replace("/packages/", "packages/")) {
      git checkout --theirs $file
      git add $file
      log "  [STREAM] $file - accepted upstream version"
    }
  }
}

# 处理 [PRESERVE] 文件：保留 fork 版本
foreach ($pattern in $preservePaths) {
  $files = git diff --name-only --diff-filter=U 2>$null
  foreach ($file in $files) {
    if ($file -like $pattern.Replace("/packages/*/", "packages/*/").Replace("/packages/", "packages/")) {
      git checkout --ours $file
      git add $file
      log "  [PRESERVE] $file - kept fork version"
    }
  }
}

# 处理 [MERGE_SAFE] 文件：冲突时保留 fork
foreach ($pattern in $mergeSafePaths) {
  $files = git diff --name-only --diff-filter=U 2>$null
  foreach ($file in $files) {
    if ($file -like $pattern.Replace("/packages/*/", "packages/*/").Replace("/packages/", "packages/")) {
      git checkout --ours $file
      git add $file
      log "  [MERGE_SAFE] $file - conflict resolved in favor of fork"
    }
  }
}

# 检查剩余未解决的冲突
$remaining = git diff --name-only --diff-filter=U 2>$null
if ($remaining) {
  warn "Remaining unresolved conflicts:"
  foreach ($f in $remaining) { Write-Host "  - $f" -ForegroundColor Yellow }

  # 生成冲突摘要 Issue 内容用于 GitHub Actions
  $conflictSummary = $remaining -join "`n"
  Set-Content -Path "/tmp/sync-conflicts.txt" -Value $conflictSummary -ErrorAction SilentlyContinue

  # 提示用户手动处理
  err "Please resolve the remaining conflicts manually, then run:"
  err "  git add ."
  err "  git commit -m 'fix: resolve sync conflicts from upstream $Ref'"
  err "  git push -u $FORK_REMOTE $BRANCH"
  exit 2
}

# ---------- 7. 提交 ----------
git commit -m $COMMIT_MSG
ok "Merge succeeded"

# ---------- 8. 差异统计 ----------
log "Diff stats vs main (before merge):"
git diff --stat HEAD~1 HEAD | Select-Object -Last 1

log "Files changed:"
git diff --name-only HEAD~1 HEAD | ForEach-Object { Write-Host "  - $_" }

# ---------- 9. 推送 ----------
$confirmation = Read-Host "[sync] Push branch '$BRANCH' to $FORK_REMOTE? [y/N]"
if ($confirmation -match "^[Yy]") {
  log "Pushing..."
  git push -u $FORK_REMOTE $BRANCH
  ok "Branch pushed. Open a PR on GitHub."
} else {
  warn "Branch NOT pushed. Run: git push -u $FORK_REMOTE $BRANCH"
}

ok "Done. Branch: $BRANCH"
