import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tar from 'tar-fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'node_modules', '@sparticuz', 'chromium', 'bin');
const target = path.join(root, 'public', 'chromium-pack.tar');

if (!fs.existsSync(source)) {
  console.warn('[chromium-pack] @sparticuz/chromium no está instalado; se omite el pack local.');
  process.exit(0);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
await new Promise((resolve, reject) => {
  const output = fs.createWriteStream(target);
  output.on('close', resolve);
  output.on('error', reject);
  tar.pack(source).on('error', reject).pipe(output);
});

console.log(`[chromium-pack] generado: ${target}`);
