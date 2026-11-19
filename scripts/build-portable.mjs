import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT_DIR, 'portable');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('1/4 Building Vite frontend...');
execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });

console.log('2/4 Preparing portable/ directory...');
const existingPortableEnvPath = path.join(OUT_DIR, '.env');
const existingPortableEnv = fs.existsSync(existingPortableEnvPath)
  ? fs.readFileSync(existingPortableEnvPath, 'utf-8')
  : null;

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

console.log('3/4 Bundling standalone server.mjs (zero node_modules required)...');
const banner = "import { createRequire as __createPortableRequire } from 'node:module'; const require = __createPortableRequire(import.meta.url);";
execSync(
  `npx esbuild server.ts --bundle --platform=node --format=esm --outfile=portable/server.mjs --external:vite --banner:js="${banner}"`,
  { cwd: ROOT_DIR, stdio: 'inherit' }
);

console.log('4/4 Copying dist/, public/, data/ and creating launchers...');
copyDirRecursive(path.join(ROOT_DIR, 'dist'), path.join(OUT_DIR, 'dist'));
copyDirRecursive(path.join(ROOT_DIR, 'public'), path.join(OUT_DIR, 'public'));
copyDirRecursive(path.join(ROOT_DIR, 'data'), path.join(OUT_DIR, 'data'));

const rootEnvPath = path.join(ROOT_DIR, '.env');
const rootEnv = fs.existsSync(rootEnvPath) ? fs.readFileSync(rootEnvPath, 'utf-8') : null;
const envTemplate = `# Optional: ใส่ค่า Turso ถ้าต้องการซิงก์ฐานข้อมูลออนไลน์ (ถ้าเว้นว่างไว้จะบันทึกข้อมูลลงไฟล์ data/db.json บนเครื่องให้อัตโนมัติ)
TURSO_DATABASE_URL=""
TURSO_AUTH_TOKEN=""
PORT=3000
`;
const finalEnvContent =
  (rootEnv && rootEnv.includes('TURSO_DATABASE_URL=')) ? rootEnv
  : (existingPortableEnv && existingPortableEnv.includes('TURSO_DATABASE_URL=')) ? existingPortableEnv
  : envTemplate;
fs.writeFileSync(path.join(OUT_DIR, '.env'), finalEnvContent, 'utf-8');

const winBat = `@echo off
chcp 65001 >nul
cd /d "%~dp0"
set NODE_ENV=production
if not defined PORT set PORT=3000

set "NODE_BIN="
if exist "%~dp0node\\node.exe" (
  set "NODE_BIN=%~dp0node\\node.exe"
) else (
  where node >nul 2>nul
  if %errorlevel%==0 set "NODE_BIN=node"
)

if "%NODE_BIN%"=="" (
  echo [ERROR] ไม่พบ Node.js บนเครื่อง หรือโฟลเดอร์ node\\node.exe
  echo กรุณาดาวน์โหลด Node.js Portable (.zip) จาก https://nodejs.org แล้วแตกไฟล์ใส่โฟลเดอร์ "node" ข้างไฟล์นี้
  pause
  exit /b 1
)

echo ============================================================
echo   Inspection Fire Extinguisher CDC (Portable Node.js)
echo   กำลังเปิดเซิร์ฟเวอร์ที่ http://localhost:%PORT%
echo ============================================================
start "" "http://localhost:%PORT%"
"%NODE_BIN%" server.mjs
pause
`;
fs.writeFileSync(path.join(OUT_DIR, 'start-windows.bat'), winBat.replace(/\n/g, '\r\n'), 'utf-8');

const unixSh = `#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
export NODE_ENV=production
export PORT="\${PORT:-3000}"

NODE_BIN=""
if [ -x "./node/bin/node" ]; then
  NODE_BIN="./node/bin/node"
elif command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
else
  echo "[ERROR] Node.js not found. Place Node Portable in ./node/ or install Node.js 20+."
  exit 1
fi

echo "Starting Inspection Fire Extinguisher CDC on http://localhost:$PORT ..."
exec "$NODE_BIN" server.mjs
`;
fs.writeFileSync(path.join(OUT_DIR, 'start.sh'), unixSh, { mode: 0o755 });

const readmeTxt = `Inspection Fire Extinguisher CDC - Node.js Portable Edition
==============================================================

วิธีใช้งาน (ไม่ต้องรัน npm install):
1. [สำหรับ Windows Portable ไม่ต้องติดตั้ง Node ลงเครื่อง]
   - ดาวน์โหลด Node.js Windows Binary (.zip) จาก https://nodejs.org (รุ่น LTS เช่น v22 x64 zip)
   - แตกไฟล์แล้วเปลี่ยนชื่อโฟลเดอร์เป็น "node" วางไว้ในโฟลเดอร์นี้ (ให้มีไฟล์ node\\node.exe)
   - (หรือถ้าเครื่องมี Node.js ติดตั้งอยู่แล้ว ข้ามข้อนี้ได้เลย)

2. [เชื่อมต่อฐานข้อมูล]
   - ใช้งานแบบออฟไลน์ / ในวง LAN: ไม่ต้องตั้งค่าอะไร ข้อมูลจะบันทึกลงไฟล์ data\\db.json อัตโนมัติ
   - ใช้งานออนไลน์เชื่อม Turso: เปิดไฟล์ .env แล้วใส่ค่า TURSO_DATABASE_URL และ TURSO_AUTH_TOKEN

3. [เปิดใช้งาน]
   - Windows: ดับเบิลคลิกไฟล์ start-windows.bat
   - macOS / Linux: รัน ./start.sh
   - เปิดเบราว์เซอร์ที่ http://localhost:3000
`;
fs.writeFileSync(path.join(OUT_DIR, 'README-PORTABLE.txt'), readmeTxt, 'utf-8');

console.log('Portable build ready at ./portable/');
