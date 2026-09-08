import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const forbidden = [
  'TELEGRAM_BOT_TOKEN',
  'SESSION_PEPPER',
  'DB_PASSWORD',
  'PRIVATE KEY-----'
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

for (const file of await walk('dist')) {
  const text = await readFile(file, 'utf8').catch(() => '');
  for (const needle of forbidden) {
    if (text.includes(needle)) {
      throw new Error(`Forbidden secret marker ${needle} found in ${file}`);
    }
  }
}
console.log('client bundle secret scan PASS');
