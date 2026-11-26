import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
const versionJsonPath = path.join(rootDir, 'public', 'version.json');
const gradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');

const args = process.argv.slice(2);
const syncOnly = args.includes('--sync-only');
const bumpMajor = args.includes('--major');
const bumpMinor = args.includes('--minor');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const currentVersion = String(pkg.version || '1.0.0');
const parts = currentVersion.split('.').map((n) => Number.parseInt(n, 10) || 0);
while (parts.length < 3) parts.push(0);

let [major, minor, patch] = parts;
if (!syncOnly) {
  if (bumpMajor) {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (bumpMinor) {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }
}

const nextVersion = `${major}.${minor}.${patch}`;
const versionCode = major * 10000 + minor * 100 + patch;

let gitCommit = '';
let gitSubject = process.env.COMMIT_MSG || 'Pembaruan sistem & telemetri EV';
try {
  gitCommit = execSync('git rev-parse --short HEAD', { cwd: rootDir, stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .trim();
  if (!process.env.COMMIT_MSG) {
    gitSubject = execSync('git log -1 --pretty=%s', { cwd: rootDir, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  }
} catch {
  // Ignore when git metadata is unavailable
}

if (!syncOnly) {
  pkg.version = nextVersion;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

// Sync Android Gradle versionCode & versionName if Capacitor android/ is present
if (fs.existsSync(gradlePath)) {
  let gradle = fs.readFileSync(gradlePath, 'utf8');
  gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
  gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${nextVersion}"`);
  fs.writeFileSync(gradlePath, gradle, 'utf8');
}

const repoSlug = process.env.GITHUB_REPOSITORY || 'armadit-eng/dashboard-app';
const apkFileName = `Dashboard-EV-v${nextVersion}.apk`;
const apkUrl = `https://github.com/${repoSlug}/releases/download/v${nextVersion}/${apkFileName}`;

const versionPayload = {
  version: nextVersion,
  versionCode,
  buildTime: new Date().toISOString(),
  commit: gitCommit || undefined,
  notes: gitSubject.split('\n')[0].trim(),
  apkFileName,
  apkUrl,
};

fs.mkdirSync(path.dirname(versionJsonPath), { recursive: true });
fs.writeFileSync(versionJsonPath, `${JSON.stringify(versionPayload, null, 2)}\n`, 'utf8');

console.log(`[version] ${syncOnly ? 'Synced' : `Bumped ${currentVersion} ->`} v${nextVersion} (code ${versionCode})`);
