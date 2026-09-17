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

console.log('=== ANALIZA MODUŁÓW FEATURES ===');
console.log(`Liczba sprawdzanych plików: ${allFiles.length}`);

// 1. Wystąpienia any / unknown
console.log('\n--- 1. ANY / UNKNOWN BEZ UZASADNIENIA ---');
for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    // szukamy : any, as any, <any>, Promise<any>, etc.
    if (/\bany\b/.test(line) && !line.includes('//') && !line.includes('eslint-disable')) {
      console.log(`${file}:${idx + 1}: ${line.trim()}`);
    }
    if (/\bunknown\b/.test(line) && !line.includes('//') && !line.includes('unknown as') && !line.includes('err: unknown')) {
      console.log(`${file}:${idx + 1} (unknown): ${line.trim()}`);
    }
  });
}

// 2. Prosta analiza zagnieżdżeń (wcięć w kodzie)
console.log('\n--- 2. ZAGNIEŻDŻENIA GŁĘBSZE NIŻ 3 POZIOMY (w logice funkcji, poza JSX) ---');
for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  let inFunction = false;
  let funcStart = 0;
  let funcName = '';

  lines.forEach((line, idx) => {
    const indentMatch = line.match(/^(\s+)/);
    const indent = indentMatch ? indentMatch[1].length : 0;
    // sprawdzenie zagnieżdżenia wcięć powyżej 16 spacji (4 wcięcia po 4 spacje lub 8 po 2 spacje)
    // jeśli to instrukcja warunkowa/pętla (if/for/while/switch/try/catch)
    if (/\b(if|for|while|switch)\b/.test(line) && indent >= 16) {
      console.log(`${file}:${idx + 1} [poziom ~${Math.floor(indent/4) || Math.floor(indent/2)}]: ${line.trim()}`);
    }
  });
}

// 3. Długie funkcje (> 60 linii)
console.log('\n--- 3. FUNKCJE DŁUŻSZE NIŻ 60 LINII ---');
for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  
  // Wyszukiwanie deklaracji funkcji i handlerów
  const funcRegex = /(?:const|function|async function)\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*[^=>]+)?\s*=>|function\s+([a-zA-Z0-9_]+)\s*\(/g;
  let match;
  while ((match = funcRegex.exec(content)) !== null) {
    const name = match[1] || match[2];
    const startIndex = match.index;
    const lineNumber = content.substring(0, startIndex).split('\n').length;
    
    // Policzmy klamry
    let braceCount = 0;
    let started = false;
    let endLine = lineNumber;
    for (let i = lineNumber - 1; i < lines.length; i++) {
      const l = lines[i];
      for (const char of l) {
        if (char === '{') {
          braceCount++;
          started = true;
        } else if (char === '}') {
          braceCount--;
        }
      }
      if (started && braceCount === 0) {
        endLine = i + 1;
        break;
      }
    }
    const length = endLine - lineNumber + 1;
    if (length > 60 && !name.endsWith('Component') && !name.endsWith('View') && !name.endsWith('Section') && !name.endsWith('Modal')) {
      console.log(`${file}:${lineNumber} funkcja '${name}': ${length} linii (${lineNumber}-${endLine})`);
    }
  }
}
