import fs from 'fs';
import path from 'path';

const dirs = [
  'src/features/vault',
  'src/features/matcher',
  'src/features/parser',
  'src/features/pipeline',
  'src/features/quickcheck'
];

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      arrayOfFiles.push(fullPath);
    }
  }
  return arrayOfFiles;
}

const allFiles = dirs.flatMap(d => getAllFiles(d));

console.log('=====================================================');
console.log('   KOMPLEKSOWY AUDYT REFAKTORYZACYJNY 5 MODUŁÓW      ');
console.log('=====================================================\n');

// 1. DŁUGIE FUNKCJE (> 60 linii)
console.log('### 1. FUNKCJE DŁUŻSZE NIŻ 60 LINII (w tym wewnętrzne handlery i hooki)\n');

for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');

  // Szukamy deklaracji: const name = (...) => { lub function name(...) {
  const fnRegex = /(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:useCallback\s*\(\s*)?(?:async\s*)?\([^)]*\)\s*(?::\s*[^=>{]+)?\s*=>\s*\{|(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\([^)]*\)\s*(?::\s*[^=>{]+)?\s*\{/g;
  let match;
  while ((match = fnRegex.exec(content)) !== null) {
    const fnName = match[1] || match[2];
    const index = match.index;
    const startLine = content.substring(0, index).split('\n').length;
    
    // Liczymy klamry od indeksu dopasowania
    let depth = 0;
    let started = false;
    let endLine = startLine;
    const startCharIndex = content.indexOf('{', index);
    
    for (let i = startCharIndex; i < content.length; i++) {
      if (content[i] === '{') {
        depth++;
        started = true;
      } else if (content[i] === '}') {
        depth--;
        if (started && depth === 0) {
          endLine = content.substring(0, i).split('\n').length;
          break;
        }
      }
    }
    const len = endLine - startLine + 1;
    if (len > 60) {
      console.log(`- \`${file}\` L${startLine}-L${endLine} (${len} linii): \`${fnName}\``);
    }
  }
}

// 2. GŁĘBOKIE ZAGNIEŻDŻENIA (> 3 poziomy logiki)
console.log('\n### 2. ZAGNIEŻDŻENIA GŁĘBSZE NIŻ 3 POZIOMY (if/for/while/switch/try/catch poza JSX)\n');
for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  let braceDepth = 0;
  let inJsx = false;

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const trimmed = line.trim();
    
    // Sprawdź czy to instrukcja sterująca
    if (/^(if|for|while|switch|try|catch)\b/.test(trimmed)) {
      // Oblicz wcięcie w spacjach
      const indent = line.search(/\S/);
      // W standardzie 2-spacji: wcięcie >= 8 spacji oznacza >= 4 poziomy zagnieżdżenia
      if (indent >= 8 && !trimmed.startsWith('//')) {
        console.log(`- \`${file}:${idx + 1}\` (wcięcie ${indent} spacji / poziom ~${Math.floor(indent/2)}): \`${trimmed.substring(0, 60)}\``);
      }
    }
  }
}

// 3. ANY / UNKNOWN BEZ UZASADNIENIA
console.log('\n### 3. ANY / UNKNOWN BEZ UZASADNIENIA\n');
for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (/\bany\b/.test(line) && !line.includes('//') && !line.includes('/*') && !line.includes('eslint-disable') && !line.includes('Record<string, any>')) {
      console.log(`- \`${file}:${idx + 1}\`: \`${line.trim()}\``);
    }
    if (/\bunknown\b/.test(line) && !line.includes('err: unknown') && !line.includes('unknown as') && !line.includes('//')) {
      console.log(`- \`${file}:${idx + 1}\` (unknown): \`${line.trim()}\``);
    }
  });
}
