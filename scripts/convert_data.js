const fs = require('fs');
const path = require('path');

const mdPath = path.join(__dirname, '..', '電機電子793單字.md');
const outDir = path.join(__dirname, '..', 'data');
const outPath = path.join(outDir, 'words.js');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const content = fs.readFileSync(mdPath, 'utf8');
const lines = content.split(/\r?\n/);

const words = [];

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) continue;
  // Format: | 1 | A | 安培(單位)的簡稱 |
  const parts = trimmed.split('|').map(s => s.trim());
  if (parts.length < 4) continue;
  const id = parseInt(parts[1], 10);
  if (isNaN(id)) continue;

  const en = parts[2];
  const zh = parts[3];

  words.push({ id, en, zh });
}

console.log(`Successfully parsed ${words.length} vocabulary items.`);

words.sort((a, b) => a.id - b.id);

const jsContent = `/**
 * PVQC 電機電子專業英文題庫 (共 ${words.length} 題)
 * 自動產生自「電機電子793單字.md」
 */
const PVQC_VOCABULARY = ${JSON.stringify(words, null, 2)};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PVQC_VOCABULARY;
}
`;

fs.writeFileSync(outPath, jsContent, 'utf8');
console.log(`Saved to ${outPath}`);
