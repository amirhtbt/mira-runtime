import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function filesUnder(root) {
  return readdirSync(root).flatMap(name => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

const legacyBrand = ['م', 'ی', 'ر', 'ا'].join('');
const trialPhrase = ['نسخه', 'آزمایشی', 'رایگان'].join(' ');

describe('G09 Bahar public runtime contract', () => {
  it('contains no legacy Persian brand or trial wording in user-facing runtime sources', () => {
    const roots = ['src', 'server/public', 'server/src/Telegram'];
    const files = roots.flatMap(filesUnder).filter(path => !/\.(?:test|spec)\.[jt]sx?$/.test(path));
    for (const path of files) {
      const content = readFileSync(path, 'utf8');
      expect(content, path).not.toContain(legacyBrand);
      expect(content, path).not.toContain(trialPhrase);
    }
  });

  it('keeps generated export delivery PDF-only', () => {
    const actions = readFileSync('src/export/DocumentExportActions.tsx', 'utf8');
    const delivery = readFileSync('src/export/deliveryApi.ts', 'utf8');
    const bridge = readFileSync('server/public/export-bridge.php', 'utf8');
    const api = readFileSync('src/api/client.ts', 'utf8');
    expect(actions).not.toContain('دریافت تصویر');
    expect(delivery).not.toContain("'png'");
    expect(bridge).not.toContain("'png'");
    expect(api).not.toMatch(/recordDocumentExport[^\n]*'png'/);
    expect(actions).toContain('دریافت PDF');
    expect(actions).toContain("text:'سند ساخته شده با فاکتورساز بهار'");
  });
});
