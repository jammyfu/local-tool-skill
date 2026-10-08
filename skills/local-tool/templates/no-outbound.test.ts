import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';
import test from 'node:test';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

const FORBIDDEN = [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /sendBeacon/,
  /googletagmanager/,
  /google-analytics/,
  /\bgtag\s*\(/,
  /plausible\.io/,
  /mixpanel/,
  /sentry\.io/,
  /unpkg\.com/,
  /jsdelivr/,
  /cdnjs\.cloudflare/,
  /maps\.googleapis/,
  /tile\.openstreetmap/,
];

function stripDownloadBlock(source: string): string {
  return source.replace(/export const MODEL_DOWNLOADS = \{[\s\S]*?\} as const;/, '');
}

test('template runtime has no outbound requests, CDN, or analytics', async () => {
  const files = (await readdir(root)).filter(name => name.endsWith('.ts') && !name.endsWith('.test.ts'));
  assert.ok(files.includes('vision.ts'));
  for (const name of files) {
    const source = stripDownloadBlock(await readFile(join(root, name), 'utf8'));
    for (const pattern of FORBIDDEN) {
      assert.equal(pattern.test(source), false, `${name} matches ${pattern}`);
    }
    assert.equal(/https?:\/\//.test(source), false, `${name} contains a runtime http(s) URL`);
  }
});
