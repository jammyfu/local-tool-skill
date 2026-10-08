import assert from 'node:assert/strict';
import test from 'node:test';
import {compressToKb, compressToTarget, formatKib, kbRangeToBytes} from './compress-to-kb.ts';

const encode = async (quality: number, width: number, height: number) => ({
  size: Math.round(40 + width * height * 0.12 * quality),
  quality,
  width,
  height,
});

test('compressToKb binary-searches quality into a KB window', async () => {
  const fit = await compressToKb(encode, 400, 500, {minKb: 10, maxKb: 40});
  assert.ok(fit.bytes <= 40 * 1024);
  assert.ok(fit.bytes >= 10 * 1024);
  assert.ok(fit.quality >= 0.12 && fit.quality <= 0.95);
  assert.equal(fit.downscaled, false);
  assert.deepEqual(kbRangeToBytes(10, 40), {minBytes: 10 * 1024, maxBytes: 40 * 1024});
  assert.equal(formatKib(2048), '2.0 KB');
});

test('compressToTarget downscales when the smallest quality still exceeds maxBytes', async () => {
  const tiny = await compressToTarget(encode, 1200, 1600, {maxBytes: 8_000}, {minScale: 0.4, scaleStep: 0.8});
  assert.ok(tiny.bytes <= 8_000);
  assert.equal(tiny.downscaled, true);
  assert.ok(tiny.width < 1200 || tiny.height < 1600);
});

test('compressToTarget with no range encodes once at high quality', async () => {
  const open = await compressToTarget(encode, 100, 100, {});
  assert.equal(open.downscaled, false);
  assert.equal(open.quality, 0.95);
  await assert.rejects(() => compressToTarget(encode, 0, 10, {}), /INVALID_DIMENSIONS/);
});
