import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = ['api', 'lib', 'public/js', 'scripts'];

function javascriptFiles(directory) {
  return readdirSync(directory, { withFileTypes:true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? javascriptFiles(path) : (entry.isFile() && entry.name.endsWith('.js') ? [path] : []);
  });
}

const files = roots.flatMap(javascriptFiles).sort();
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio:'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`Sintaxis válida: ${files.length} archivos JavaScript.`);
