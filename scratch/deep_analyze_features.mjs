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

console.log('=== GŁĘBOKA ANALIZA KODU FEATURES ===\n');

for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  const totalLines = lines.length;
  
  // Wyszukajmy funkcje i metody
  // np: const foo = (...) => {, function foo(...) {, async function foo(...) {
  const functionDefs = [];
  const regex = /^\s*(?:export\s+)?(?:const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*[^=>]+)?\s*=>|(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\()/gm;
  
  let m;
  while ((m = regex.exec(content)) !== null) {
    const name = m[1] || m[2];
    const index = m.index;
    const lineNum = content.substring(0, index).split('\n').length;
    
    // Zliczanie klamer
    let depth = 0;
    let started = false;
    let endLine = lineNum;
    for (let i = lineNum - 1; i < lines.length; i++) {
      const l = lines[i];
      for (let c = 0; c < l.length; c++) {
        const ch = l[c];
        if (ch === '{') {
          depth++;
          started = true;
        } else if (ch === '}') {
          depth--;
          if (started && depth === 0) {
            endLine = i + 1;
            break;
          }
        }
      }
      if (started && depth === 0) break;
    }
    const len = endLine - lineNum + 1;
    functionDefs.push({ name, lineNum, endLine, len });
  }

  const longFuncs = functionDefs.filter(f => f.len > 60);
  if (longFuncs.length > 0) {
    console.log(`\n📄 ${file} (${totalLines} linii):`);
    for (const f of longFuncs) {
      console.log(`   - Funkcja '${f.name}': ${f.len} linii (L${f.lineNum}-L${f.endLine})`);
    }
  }
}
