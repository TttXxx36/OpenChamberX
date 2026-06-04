# Windows Clean Upgrade Install Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Windows installer upgrade option that removes stale application files from the existing install directory while preserving all user data.

**Architecture:** Keep user data untouched by cleaning only `$INSTDIR`, never `%APPDATA%\OpenChamber`, `%LOCALAPPDATA%\OpenChamber`, or Electron `userData`. Use an electron-builder NSIS include script to show an upgrade-only checkbox and run cleanup before new files are extracted. Add tests that lock the NSIS configuration and prevent accidental user-data deletion commands.

**Tech Stack:** Electron Builder NSIS, NSIS custom include macros, Node test runner, PowerShell/GitHub Actions for Windows release verification.

---

## Problem Summary

The installer hang was reproduced only on a machine with an existing OpenChamber X install. A fresh machine installed successfully. Deleting old files from the installation directory made the same installer work locally.

That points away from a build/package corruption bug and toward stale files in the previous install directory conflicting with the new package layout. This is especially plausible now that `web-dist` moved from unpacked `extraResources` into `app.asar`; old `resources/web-dist` leftovers can remain on disk even when the new build no longer expects them there.

## Desired Behavior

On Windows upgrade installs:

- Show an option: `Remove old application files before installing (preserves user data)`.
- Default the option to checked for upgrades.
- Delete only application installation files under `$INSTDIR`.
- Preserve user data, settings, sessions, logs, auth state, and caches under user-profile data directories.
- Continue supporting normal fresh installs with no extra page shown.
- Continue supporting portable builds without this NSIS upgrade page affecting portable behavior.

## Files

- Modify: `packages/electron/package.json`
  - Add `nsis.include` pointing to `scripts/installer.nsh`.
  - Add explicit NSIS safety settings: `deleteAppDataOnUninstall: false`, `closeRunningApp: true`.
- Create: `packages/electron/scripts/installer.nsh`
  - Defines the upgrade checkbox page.
  - Detects whether `$INSTDIR` looks like an existing OpenChamber install.
  - Deletes stale app files only when the checkbox is checked.
- Modify: `packages/electron/scripts/installer-package.test.mjs`
  - Verify package config includes the NSIS include.
  - Verify app-data deletion stays disabled.
  - Verify the NSIS script never references `%APPDATA%`, `$APPDATA`, `$LOCALAPPDATA`, or Electron user data locations.
  - Verify cleanup is limited to `$INSTDIR`.

---

### Task 1: Lock NSIS Upgrade Cleanup Requirements With Tests

**Files:**
- Modify: `packages/electron/scripts/installer-package.test.mjs`

- [ ] **Step 1: Add tests for NSIS include and user-data preservation**

Add this test block to `packages/electron/scripts/installer-package.test.mjs`:

```js
test('Windows NSIS installer supports clean upgrades without deleting user data', () => {
  const packageJson = JSON.parse(readText('package.json'));
  const nsis = packageJson.build.nsis;
  const installerScript = readText('scripts/installer.nsh');

  assert.equal(nsis.include, 'scripts/installer.nsh');
  assert.equal(nsis.deleteAppDataOnUninstall, false);
  assert.equal(nsis.closeRunningApp, true);

  assert.match(installerScript, /Remove old application files before installing/);
  assert.match(installerScript, /\$INSTDIR/);
  assert.doesNotMatch(installerScript, /\$APPDATA|\$LOCALAPPDATA|%APPDATA%|%LOCALAPPDATA%|userData/i);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
node --test packages/electron/scripts/installer-package.test.mjs
```

Expected: FAIL because `scripts/installer.nsh` does not exist and `nsis.include` is not configured.

---

### Task 2: Configure Electron Builder NSIS Options

**Files:**
- Modify: `packages/electron/package.json`

- [ ] **Step 1: Update the `nsis` config**

In `packages/electron/package.json`, change the `build.nsis` block to include these fields:

```json
"nsis": {
  "oneClick": false,
  "perMachine": false,
  "allowToChangeInstallationDirectory": true,
  "createDesktopShortcut": true,
  "createStartMenuShortcut": true,
  "shortcutName": "OpenChamber",
  "artifactName": "${productName}-${version}-${arch}.${ext}",
  "deleteAppDataOnUninstall": false,
  "closeRunningApp": true,
  "include": "scripts/installer.nsh"
}
```

Why:

- `deleteAppDataOnUninstall: false` preserves Electron app data even if the uninstaller path is used.
- `closeRunningApp: true` reduces locked-file failures before cleanup.
- `include` wires the custom upgrade page and cleanup macro into electron-builder's generated NSIS script.

- [ ] **Step 2: Validate JSON**

Run:

```powershell
node -e "JSON.parse(require('fs').readFileSync('packages/electron/package.json','utf8')); console.log('electron package.json parsed')"
```

Expected: `electron package.json parsed`.

---

### Task 3: Add The NSIS Clean Upgrade Script

**Files:**
- Create: `packages/electron/scripts/installer.nsh`

- [ ] **Step 1: Create the NSIS include script**

Create `packages/electron/scripts/installer.nsh` with:

```nsis
!include LogicLib.nsh
!include nsDialogs.nsh

Var OpenChamberCleanUpgradeCheckbox
Var OpenChamberCleanUpgradeChoice

!macro customHeader
  Page custom OpenChamberCleanUpgradePageCreate OpenChamberCleanUpgradePageLeave
!macroend

Function OpenChamberIsExistingInstall
  ClearErrors
  IfFileExists "$INSTDIR\OpenChamber.exe" 0 checkResources
  Push 1
  Return

  checkResources:
  IfFileExists "$INSTDIR\resources\*.*" 0 notExisting
  Push 1
  Return

  notExisting:
  Push 0
FunctionEnd

Function OpenChamberCleanUpgradePageCreate
  Call OpenChamberIsExistingInstall
  Pop $0
  StrCmp $0 1 0 skipPage

  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 28u "OpenChamber X is already installed in this folder. You can remove old application files before installing this version. User data, settings, sessions, and caches are preserved."
  Pop $0

  ${NSD_CreateCheckbox} 0 42u 100% 12u "Remove old application files before installing (preserves user data)"
  Pop $OpenChamberCleanUpgradeCheckbox
  ${NSD_Check} $OpenChamberCleanUpgradeCheckbox

  nsDialogs::Show
  Return

  skipPage:
  Abort
FunctionEnd

Function OpenChamberCleanUpgradePageLeave
  ${NSD_GetState} $OpenChamberCleanUpgradeCheckbox $OpenChamberCleanUpgradeChoice
FunctionEnd

Function OpenChamberRemoveOldApplicationFiles
  Call OpenChamberIsExistingInstall
  Pop $0
  StrCmp $0 1 0 done

  Delete "$INSTDIR\OpenChamber.exe"
  Delete "$INSTDIR\*.dll"
  Delete "$INSTDIR\*.pak"
  Delete "$INSTDIR\*.bin"
  Delete "$INSTDIR\*.dat"
  Delete "$INSTDIR\*.json"
  Delete "$INSTDIR\*.yml"
  Delete "$INSTDIR\*.yaml"

  RMDir /r "$INSTDIR\locales"
  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\swiftshader"

  done:
FunctionEnd

!macro customInstall
  StrCmp $OpenChamberCleanUpgradeChoice ${BST_CHECKED} 0 done
  DetailPrint "Removing old OpenChamber application files while preserving user data..."
  Call OpenChamberRemoveOldApplicationFiles
  done:
!macroend
```

Important safety rule:

The script must only delete under `$INSTDIR`. Do not reference `$APPDATA`, `$LOCALAPPDATA`, `%APPDATA%`, `%LOCALAPPDATA%`, `AppData`, or `userData`.

- [ ] **Step 2: Run tests and verify the new NSIS checks pass**

Run:

```powershell
node --test packages/electron/scripts/installer-package.test.mjs
```

Expected: all tests pass.

---

### Task 4: Validate Installer Script Syntax Via Electron Build Inputs

**Files:**
- Read-only validation for `packages/electron/package.json`
- Read-only validation for `packages/electron/scripts/installer.nsh`

- [ ] **Step 1: Run syntax checks**

Run:

```powershell
node --check packages/electron/main.mjs
node --check packages/electron/scripts/build-web-assets.mjs
node --check packages/electron/scripts/rebuild-native.mjs
```

Expected: no output and exit code 0 for each command.

- [ ] **Step 2: Run project validation**

Run:

```powershell
bun run lint
bun run type-check
```

Expected: all packages exit with code 0.

- [ ] **Step 3: Run whitespace check**

Run:

```powershell
git diff --check -- packages/electron/package.json packages/electron/scripts/installer.nsh packages/electron/scripts/installer-package.test.mjs
```

Expected: no whitespace errors. CRLF warnings are acceptable on this repo.

---

### Task 5: CI Verification On A Real Windows Installer

**Files:**
- No source edits unless CI exposes a concrete failure.

- [ ] **Step 1: Commit and push only the installer cleanup files**

Run:

```powershell
git add packages/electron/package.json packages/electron/scripts/installer.nsh packages/electron/scripts/installer-package.test.mjs
git commit -m "fix(electron): add clean upgrade installer option"
git push origin main
```

Expected: GitHub Actions starts the Windows build/release workflow.

- [ ] **Step 2: Inspect GitHub Actions logs**

Expected in `Build Electron Windows artifacts` logs:

```text
[electron] web-dist: ... files, ... MB
[electron] web-dist largest: ...
```

Expected in artifacts:

- NSIS installer `.exe`
- Portable `.exe`
- `latest.yml`
- `.blockmap`

- [ ] **Step 3: Test upgrade install on the affected machine**

Manual test steps:

1. Install an older OpenChamber X build.
2. Launch it once and confirm user data exists.
3. Run the new installer.
4. Confirm the clean-upgrade checkbox appears.
5. Leave it checked.
6. Complete installation.
7. Launch OpenChamber X.
8. Confirm sessions/settings still exist.
9. Confirm stale install files such as old `resources/web-dist` are gone from `$INSTDIR`.

Expected: upgrade completes without the 60% stall and user data remains intact.

- [ ] **Step 4: Test fresh install on a clean machine**

Manual test steps:

1. Use a machine without OpenChamber X installed.
2. Run the installer.
3. Confirm no clean-upgrade page appears.
4. Complete installation.
5. Launch OpenChamber X.

Expected: fresh install behavior is unchanged.

---

## Rollback Plan

If the custom NSIS page causes installer generation or upgrade failures:

1. Remove `include: "scripts/installer.nsh"` from `packages/electron/package.json`.
2. Keep `deleteAppDataOnUninstall: false` and `closeRunningApp: true` because they are safe defaults.
3. Delete `packages/electron/scripts/installer.nsh`.
4. Keep the tests that assert user data is not deleted, but update them to only enforce `deleteAppDataOnUninstall: false`.

---

## Notes And Risks

- This plan intentionally does not delete user data. It only removes files under `$INSTDIR`.
- If a user manually chose an install directory that contains unrelated files, deleting broad folders under `$INSTDIR` could still be risky. The script first checks for OpenChamber markers before cleanup and deletes only known app artifact names/directories.
- `RMDir /r "$INSTDIR\resources"` is required because old unpacked `resources/web-dist` is exactly the kind of stale resource that can conflict with the current asar layout.
- The option is upgrade-only. Fresh installs skip the page.
- The option should default to checked because it is the safer upgrade path for users affected by stale install files.
