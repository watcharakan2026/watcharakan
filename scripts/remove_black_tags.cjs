const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

function detectBox(item) {
  const pageFile = path.join(__dirname, '..', 'public', 'layouts_backup', `zone-page-${String(item.pageNumber).padStart(2, '0')}.png`);
  const cx = Math.round(item.xPercent * 20);
  const cy = Math.round(item.yPercent * 11.25);
  const cropW = 140;
  const cropH = 90;
  const cropX = Math.max(0, cx - Math.floor(cropW / 2));
  const cropY = Math.max(0, cy - Math.floor(cropH / 2));

  try {
    const cmd = `convert "${pageFile}" -crop ${cropW}x${cropH}+${cropX}+${cropY} txt:-`;
    const txt = execSync(cmd).toString();
    const lines = txt.split('\n');

    const rows = {};
    for (const line of lines) {
      const m = line.match(/^(\d+),(\d+): \((\d+),(\d+),(\d+)\)/);
      if (m) {
        const [_, x, y, r, g, b] = m.map(Number);
        if (r < 50 && g < 50 && b < 50) {
          if (!rows[y]) rows[y] = [];
          rows[y].push(x);
        }
      }
    }

    const targetX = cx - cropX;
    const targetY = cy - cropY;

    const candidateRows = [];
    for (const [yStr, xs] of Object.entries(rows)) {
      const y = Number(yStr);
      const nearXs = xs.filter(x => Math.abs(x - targetX) <= 60);
      if (nearXs.length >= 25) {
        const minX = Math.min(...nearXs);
        const maxX = Math.max(...nearXs);
        if (minX <= targetX - 5 && maxX >= targetX + 5 && (maxX - minX + 1) >= 35 && (maxX - minX + 1) <= 110) {
          candidateRows.push({ y, minX, maxX });
        }
      }
    }

    const boxRows = candidateRows.filter(r => Math.abs(r.y - targetY) <= 25);
    if (boxRows.length >= 18) {
      const lefts = boxRows.map(r => r.minX);
      const rights = boxRows.map(r => r.maxX);
      lefts.sort((a, b) => a - b);
      rights.sort((a, b) => a - b);
      const left = lefts[Math.floor(lefts.length * 0.2)];
      const right = rights[Math.floor(rights.length * 0.8)];
      const ys = boxRows.map(r => r.y);
      return {
        id: item.id,
        pageNumber: item.pageNumber,
        found: true,
        rect: {
          x1: cropX + left - 1,
          y1: cropY + Math.min(...ys) - 1,
          x2: cropX + right + 1,
          y2: cropY + Math.max(...ys) + 1
        }
      };
    }
  } catch (err) {
    console.error(`Error detecting ${item.id}:`, err.message);
  }

  // Fallback
  const len = item.id.length;
  const w = len <= 3 ? 50 : len === 4 ? 66 : 82;
  const h = 38;
  return {
    id: item.id,
    pageNumber: item.pageNumber,
    found: false,
    rect: {
      x1: Math.round(cx - w / 2) - 1,
      y1: Math.round(cy - h / 2) - 1,
      x2: Math.round(cx + w / 2) + 1,
      y2: Math.round(cy + h / 2) + 1
    }
  };
}

async function main() {
  console.log(`Starting black tag removal for ${db.equipment.length} items across 20 layout maps...`);

  // Group items by page
  const pageMap = {};
  for (let p = 1; p <= 20; p++) pageMap[p] = [];
  for (const item of db.equipment) {
    pageMap[item.pageNumber].push(item);
  }

  for (let pageNum = 1; pageNum <= 20; pageNum++) {
    const items = pageMap[pageNum];
    const pageFileName = `zone-page-${String(pageNum).padStart(2, '0')}.png`;
    const inputFile = path.join(__dirname, '..', 'public', 'layouts_backup', pageFileName);
    const outputFile = path.join(__dirname, '..', 'public', 'layouts', pageFileName);

    if (items.length === 0) {
      console.log(`Page ${pageNum}: No items, copying original...`);
      fs.copyFileSync(inputFile, outputFile);
      continue;
    }

    console.log(`Page ${pageNum}: Processing ${items.length} items...`);
    const drawCommands = [];

    for (const item of items) {
      const box = detectBox(item);
      drawCommands.push(`-draw "rectangle ${box.rect.x1},${box.rect.y1} ${box.rect.x2},${box.rect.y2}"`);
    }

    const fullCmd = `convert "${inputFile}" -fill "#FFFFFF" -stroke "#FFFFFF" ${drawCommands.join(' ')} "${outputFile}"`;
    execSync(fullCmd);
    console.log(`Page ${pageNum}: Successfully removed ${items.length} black tags.`);
  }

  console.log('ALL 20 PAGES COMPLETED SUCCESSFULLY!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
