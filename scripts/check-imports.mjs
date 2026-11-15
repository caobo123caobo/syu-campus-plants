/* 静态检查 import/export 是否对得上：node scripts/check-imports.mjs */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const JS = join(ROOT, 'assets', 'js');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

const files = walk(JS);
const exportsMap = new Map();
const imports = [];

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of m[1].split(',')) {
      const n = part.trim().split(/\s+as\s+/).pop().trim();
      if (n) names.add(n);
    }
  }
  exportsMap.set(file, names);
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    imports.push({ file, names: m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean), from: m[2] });
  }
}

let errors = 0;
for (const imp of imports) {
  if (!imp.from.startsWith('.')) continue;
  const target = resolve(dirname(imp.file), imp.from);
  if (!exportsMap.has(target)) {
    console.log(`✗ ${relative(ROOT, imp.file)} 引用了不存在的模块 ${imp.from}`);
    errors++;
    continue;
  }
  const available = exportsMap.get(target);
  for (const n of imp.names) {
    if (n === 'default') continue;
    if (!available.has(n)) {
      console.log(`✗ ${relative(ROOT, imp.file)} 从 ${imp.from} 导入了未导出的 ${n}`);
      errors++;
    }
  }
}
console.log(errors ? `\n❌ ${errors} 个导入错误` : `\n✅ ${imports.length} 条 import 全部对得上`);
if (errors) process.exit(1);
