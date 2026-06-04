import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const webDir = path.join(repoRoot, 'packages', 'web');
const electronDir = path.join(repoRoot, 'packages', 'electron');

const resourcesDir = path.join(electronDir, 'resources');
const resourcesWebDistDir = path.join(resourcesDir, 'web-dist');
const webDistDir = path.join(webDir, 'dist');

const quoteWindowsCommandArg = (value) => `"${String(value).replace(/"/g, '""')}"`;

const hasPathSeparator = (value) => value.includes('/') || value.includes('\\');

const run = (cmd, args, cwd) => {
  const isWindowsCommandScript = process.platform === 'win32' && /\.(cmd|bat)$/i.test(cmd);
  const result = isWindowsCommandScript
    ? spawnSync(
        process.env.ComSpec || 'cmd.exe',
        ['/d', '/s', '/c', ['call', quoteWindowsCommandArg(cmd), ...args.map(quoteWindowsCommandArg)].join(' ')],
        { cwd, stdio: 'inherit', windowsVerbatimArguments: true },
      )
    : spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
};

const resolveWindowsExecutableCandidate = (value) => {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!candidate) return null;

  const extension = path.extname(candidate).toLowerCase();
  if (extension === '.exe' || extension === '.cmd' || extension === '.bat') {
    return candidate;
  }
  if (!hasPathSeparator(candidate)) {
    return null;
  }

  for (const suffix of ['.exe', '.cmd', '.bat']) {
    const withSuffix = `${candidate}${suffix}`;
    if (existsSync(withSuffix)) {
      return withSuffix;
    }
  }
  return null;
};

const resolveWindowsBun = () => {
  for (const candidate of [process.env.BUN, process.env.npm_execpath, process.env.BUN_INSTALL ? path.join(process.env.BUN_INSTALL, 'bin', 'bun') : null]) {
    const resolved = resolveWindowsExecutableCandidate(candidate);
    if (resolved) return resolved;
  }

  for (const command of ['bun.exe', 'bun.cmd']) {
    const result = spawnSync('where.exe', [command], { encoding: 'utf8' });
    const resolved = (result.stdout || '').split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    if (resolved) return resolved;
  }

  return 'bun.exe';
};

const resolveBun = () => {
  if (process.platform === 'win32') {
    return resolveWindowsBun();
  }
  if (typeof process.env.BUN === 'string' && process.env.BUN.trim()) {
    return process.env.BUN.trim();
  }
  const result = spawnSync('/bin/bash', ['-lc', 'command -v bun'], { encoding: 'utf8' });
  const resolved = (result.stdout || '').trim();
  return resolved || 'bun';
};

const formatBytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

const collectDirectoryStats = async (target) => {
  const stats = { files: 0, bytes: 0, largest: [] };
  const visit = async (dir) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await visit(entryPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const info = await fs.stat(entryPath);
      stats.files += 1;
      stats.bytes += info.size;
      stats.largest.push({ file: path.relative(target, entryPath), bytes: info.size });
    }
  };

  await visit(target);
  stats.largest.sort((left, right) => right.bytes - left.bytes);
  stats.largest = stats.largest.slice(0, 10);
  return stats;
};

const logDirectoryStats = async (label, target) => {
  const stats = await collectDirectoryStats(target);
  console.log(`[electron] ${label}: ${stats.files} files, ${formatBytes(stats.bytes)}`);
  for (const item of stats.largest) {
    console.log(`[electron] ${label} largest: ${formatBytes(item.bytes)} ${item.file}`);
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const removeDir = async (target) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await fs.rm(target, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 4) throw error;
      if (!['ENOTEMPTY', 'EBUSY', 'EPERM'].includes(error?.code)) throw error;
      await sleep(100 * (attempt + 1));
    }
  }
};

const copyDir = async (src, dst) => {
  await fs.mkdir(dst, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      await copyDir(from, to);
    } else {
      await fs.copyFile(from, to);
    }
  }
};

const bunExe = resolveBun();

console.log('[electron] building web UI dist...');
run(bunExe, ['run', 'build'], webDir);

console.log('[electron] staging packaged resources...');
await fs.mkdir(resourcesDir, { recursive: true });
const stagedWebDistDir = await fs.mkdtemp(path.join(resourcesDir, 'web-dist-staging-'));
await copyDir(webDistDir, stagedWebDistDir);
await removeDir(resourcesWebDistDir);
await fs.rename(stagedWebDistDir, resourcesWebDistDir);
await logDirectoryStats('web-dist', resourcesWebDistDir);

console.log(`[electron] web assets ready: ${resourcesWebDistDir}`);
