import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mmToPx,
  parseToolSpec,
  parseToolSpecBundle,
  pickLocale,
  pxToMm,
  resolveOutputSize,
} from './spec.ts';

const validSpec = {
  id: 'sample-exam',
  name: {en: 'Sample exam', zh: '示例考试'},
  notes: {en: 'Verified fixture used only in tests.', zh: '仅用于测试的已核对条目。'},
  sources: [{url: 'https://example.org/official', title: 'Official page', checked: '2026-10-08'}],
  size: {
    pixels: {width: 413, height: 531},
    print_mm: {width: 35, height: 45},
    dpi: 300,
  },
  file: {formats: ['jpg'], min_kb: 10, max_kb: 200},
  status: 'verified',
};

test('parseToolSpec accepts the contract and rejects invented gaps', () => {
  const spec = parseToolSpec(validSpec);
  assert.equal(spec.id, 'sample-exam');
  assert.deepEqual(spec.size.printMm, {width: 35, height: 45});
  assert.equal(spec.file.minKb, 10);
  assert.throws(() => parseToolSpec({...validSpec, id: 'Not_Kebab'}), /kebab/);
  assert.throws(() => parseToolSpec({...validSpec, sources: []}), /sources/);
  assert.throws(() => parseToolSpec({...validSpec, sources: [{...validSpec.sources[0], url: 'http://example.org'}]}), /https/);
  const bundle = parseToolSpecBundle({
    version: '1.0.0',
    generated: '2026-10-08',
    specs: [validSpec, {...validSpec, id: 'other-exam'}],
  });
  assert.deepEqual(bundle.specs.map(item => item.id), ['other-exam', 'sample-exam']);
  assert.throws(
    () => parseToolSpecBundle({version: '1.0.0', generated: '2026-10-08', specs: [validSpec, validSpec]}),
    /duplicate/,
  );
});

test('mm/dpi/px math matches 300 dpi and does not invent a size', () => {
  assert.equal(mmToPx(25.4, 300), 300);
  assert.equal(mmToPx(35, 300), 413);
  assert.equal(mmToPx(45, 300), 531);
  assert.equal(mmToPx(51, 300), 602);
  assert.ok(Math.abs(pxToMm(413, 300) - 35) < 0.05);
  const fromPixels = resolveOutputSize(parseToolSpec(validSpec));
  assert.deepEqual(
    {width: fromPixels.width, height: fromPixels.height, source: fromPixels.source},
    {width: 413, height: 531, source: 'pixels'},
  );
  const fromMm = resolveOutputSize(parseToolSpec({
    ...validSpec,
    size: {pixels: {width: null, height: null}, print_mm: {width: 35, height: 45}, dpi: null},
  }));
  assert.equal(fromMm.source, 'print-mm');
  assert.equal(fromMm.assumedDpi, true);
  assert.deepEqual({width: fromMm.width, height: fromMm.height}, {width: 413, height: 531});
  const customPx = resolveOutputSize(parseToolSpec(validSpec), {mode: 'px', width: 600, height: 800});
  assert.equal(customPx.source, 'custom');
  assert.throws(
    () => resolveOutputSize(parseToolSpec({
      ...validSpec,
      size: {pixels: {width: null, height: null}, print_mm: {width: null, height: null}, dpi: null},
    })),
    /export size/,
  );
});

test('pickLocale prefers zh then optional extras then en', () => {
  const spec = parseToolSpec({
    ...validSpec,
    name: {en: 'Sample exam', zh: '示例考试', ja: 'サンプル'},
  });
  assert.equal(pickLocale(spec.name, 'zh'), '示例考试');
  assert.equal(pickLocale(spec.name, 'ja'), 'サンプル');
  assert.equal(pickLocale(spec.name, 'en'), 'Sample exam');
  assert.equal(pickLocale(spec.name, 'ko'), 'Sample exam');
});
