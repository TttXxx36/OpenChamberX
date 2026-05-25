#!/usr/bin/env bash
# Workaround for Tauri + bun-compiled sidecars on Linux:
#
# `tauri build` on Linux first stages all binaries into AppDir, then runs
# `linuxdeploy` to scan ELF dependencies and patch rpaths/INTERPs of every
# executable under usr/bin. Our `openchamber-server` sidecar is a single-file
# bun --compile bundle: a real ELF launcher followed by an appended "bunfs"
# self-extracting payload. Two things go wrong:
#
#   1. linuxdeploy's ldd-based dependency scan exits 1 on the bun binary
#      (bunfs offsets confuse ldd), aborting AppImage generation entirely.
#   2. Even when scanning succeeds, linuxdeploy patches the ELF headers,
#      which shifts file offsets and corrupts the bunfs payload at runtime
#      (the server segfaults on startup with SIGSEGV).
#
# This script runs AFTER `tauri build` and:
#   - Locates the pristine sidecar staged into the .deb data dir
#     (Tauri does NOT post-process the .deb staging, only the AppDir).
#   - Replaces the corrupted AppDir copy with the pristine one.
#   - Repackages the AppImage with `appimagetool` (downloaded on demand,
#     cached under ~/.cache/openchamber/appimagetool).
#
# The .deb produced by `tauri build` is correct as-is and is left untouched.

set -euo pipefail

DESKTOP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUNDLE_DIR="$DESKTOP_DIR/src-tauri/target/release/bundle"
APPIMAGE_DIR="$BUNDLE_DIR/appimage"
DEB_STAGING_DIR="$BUNDLE_DIR/appimage_deb/data/usr/bin"

if [[ ! -d "$APPIMAGE_DIR" ]]; then
  echo "[fix-linux-appimage] No appimage bundle dir found at $APPIMAGE_DIR - nothing to fix."
  exit 0
fi

APPDIR="$(find "$APPIMAGE_DIR" -maxdepth 1 -type d -name '*.AppDir' | head -n1)"
if [[ -z "$APPDIR" ]]; then
  echo "[fix-linux-appimage] No *.AppDir found under $APPIMAGE_DIR - nothing to fix." >&2
  exit 1
fi

APPIMAGE_OUT="$(find "$APPIMAGE_DIR" -maxdepth 1 -type f -name '*.AppImage' | head -n1)"
if [[ -z "$APPIMAGE_OUT" ]]; then
  # tauri may have failed at the AppImage step. Pick the expected name from
  # the AppDir folder.
  APPDIR_BASE="$(basename "$APPDIR" .AppDir)"
  VERSION="$(grep -oP '"version"\s*:\s*"\K[^"]+' "$DESKTOP_DIR/package.json" | head -n1)"
  APPIMAGE_OUT="$APPIMAGE_DIR/${APPDIR_BASE}_${VERSION}_amd64.AppImage"
fi

PRISTINE_SIDECAR="$DEB_STAGING_DIR/openchamber-server"
APPDIR_SIDECAR="$APPDIR/usr/bin/openchamber-server"

if [[ ! -f "$PRISTINE_SIDECAR" ]]; then
  echo "[fix-linux-appimage] Pristine sidecar not found at $PRISTINE_SIDECAR." >&2
  echo "[fix-linux-appimage] Was 'tauri build' run? .deb staging is required for the workaround." >&2
  exit 1
fi
if [[ ! -f "$APPDIR_SIDECAR" ]]; then
  echo "[fix-linux-appimage] AppDir sidecar not found at $APPDIR_SIDECAR." >&2
  exit 1
fi

if cmp -s "$PRISTINE_SIDECAR" "$APPDIR_SIDECAR"; then
  echo "[fix-linux-appimage] AppDir sidecar already matches pristine - assuming AppImage is already fixed."
else
  echo "[fix-linux-appimage] Restoring pristine sidecar into AppDir..."
  cp -f "$PRISTINE_SIDECAR" "$APPDIR_SIDECAR"
  chmod +x "$APPDIR_SIDECAR"
fi

CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/openchamber"
APPIMAGETOOL="$CACHE_DIR/appimagetool-x86_64.AppImage"
mkdir -p "$CACHE_DIR"
if [[ ! -x "$APPIMAGETOOL" ]]; then
  echo "[fix-linux-appimage] Downloading appimagetool -> $APPIMAGETOOL"
  curl -fsSL -o "$APPIMAGETOOL" \
    https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage
  chmod +x "$APPIMAGETOOL"
fi

echo "[fix-linux-appimage] Repackaging $APPIMAGE_OUT..."
rm -f "$APPIMAGE_OUT"
ARCH=x86_64 APPIMAGE_EXTRACT_AND_RUN=1 \
  "$APPIMAGETOOL" --no-appstream "$APPDIR" "$APPIMAGE_OUT" >/dev/null

echo "[fix-linux-appimage] OK: $(ls -la "$APPIMAGE_OUT")"
