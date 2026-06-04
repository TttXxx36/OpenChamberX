import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const electronDir = path.resolve(__dirname, '..');

const readText = (relativePath) => fs.readFileSync(path.join(electronDir, relativePath), 'utf8');

test('Windows installer package excludes debug and non-target native payloads', () => {
  const packageJson = JSON.parse(readText('package.json'));
  const files = packageJson.build.files;

  assert.ok(files.includes('!**/*.pdb'));
  assert.ok(files.includes('!**/node-pty/prebuilds/win32-arm64/**'));
  assert.ok(files.includes('!**/node-pty/third_party/**/win10-arm64/**'));
  assert.ok(files.includes('!**/bun-pty/**'));
});

test('packaged web assets live inside app.asar instead of extraResources', () => {
  const packageJson = JSON.parse(readText('package.json'));
  const files = packageJson.build.files;
  const extraResources = packageJson.build.extraResources ?? [];
  const mainScript = readText('main.mjs');

  assert.ok(files.includes('resources/web-dist/**'));
  assert.ok(!extraResources.some((entry) => entry.from === 'resources/web-dist' || entry.to === 'web-dist'));
  assert.match(mainScript, /app\.getAppPath\(\).*resources.*web-dist/s);
  assert.match(mainScript, /fsp\.readFile\(filePath\)/);
  assert.doesNotMatch(mainScript, /electronNet\.fetch\(pathToFileURL\(filePath\)/);
});

test('Windows NSIS installer supports clean upgrades without deleting user data', () => {
  const packageJson = JSON.parse(readText('package.json'));
  const nsis = packageJson.build.nsis;
  const installerScript = readText('scripts/installer.nsh');

  assert.equal(nsis.include, 'scripts/installer.nsh');
  assert.equal(nsis.deleteAppDataOnUninstall, false);

  assert.match(installerScript, /customInit/);
  assert.match(installerScript, /taskkill.*OpenChamber\.exe/);
  assert.match(installerScript, /Remove old application files before installing/);
  assert.match(installerScript, /\$INSTDIR/);
  assert.doesNotMatch(installerScript, /\$APPDATA|\$LOCALAPPDATA|%APPDATA%|%LOCALAPPDATA%|AppData|userData/i);
  assert.doesNotMatch(installerScript, /Delete "\$INSTDIR\\\*\.json"/);
});

test('Electron native rebuild skips Bun-only PTY backend', () => {
  const rebuildScript = readText('scripts/rebuild-native.mjs');

  assert.match(rebuildScript, /onlyModules:\s*\[[^\]]*'better-sqlite3'[^\]]*'node-pty'[^\]]*\]/s);
  assert.doesNotMatch(rebuildScript, /onlyModules:\s*\[[^\]]*'bun-pty'[^\]]*\]/s);
});

test('web asset build logs resource size and supports Windows bun command shims', () => {
  const buildScript = readText('scripts/build-web-assets.mjs');

  assert.match(buildScript, /logDirectoryStats/);
  assert.match(buildScript, /bun\.cmd/);
});
