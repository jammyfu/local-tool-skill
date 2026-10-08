import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertSameOriginAsset,
  loadVision,
  MODEL_DOWNLOADS,
  resetVision,
  vendorPaths,
  visionLoaded,
  type VisionRuntime,
} from './vision.ts';

function mockRuntime(options?: {failGpu?: boolean; calls?: string[]}): VisionRuntime {
  const calls = options?.calls ?? [];
  return {
    async fileset(wasmPath) {
      calls.push(`fileset:${wasmPath}`);
      return {wasmPath};
    },
    async createSegmenter(_fileset, opts) {
      calls.push(`segmenter:${opts.delegate}:${opts.modelAssetPath}`);
      if (options?.failGpu && opts.delegate === 'GPU') throw new Error('no gpu');
      return {kind: 'segmenter', delegate: opts.delegate};
    },
    async createDetector(_fileset, opts) {
      calls.push(`detector:${opts.delegate}:${opts.modelAssetPath}`);
      if (options?.failGpu && opts.delegate === 'GPU') throw new Error('no gpu');
      return {kind: 'detector', delegate: opts.delegate};
    },
  };
}

test('vendorPaths stay same-origin and models are Apache-2.0', () => {
  const paths = vendorPaths();
  assert.match(paths.wasm, /^\/vendor\/mediapipe\/0\.10\.32\/wasm$/);
  assert.match(paths.segmenter, /selfie_segmenter\.tflite$/);
  assert.match(paths.face, /blaze_face_short_range\.tflite$/);
  assert.doesNotThrow(() => assertSameOriginAsset(paths.wasm));
  assert.throws(() => assertSameOriginAsset(MODEL_DOWNLOADS.selfieSegmenter.url), /REMOTE_ASSET/);
  assert.equal(MODEL_DOWNLOADS.selfieSegmenter.license, 'Apache-2.0');
  assert.equal(MODEL_DOWNLOADS.blazeFace.license, 'Apache-2.0');
  assert.equal(MODEL_DOWNLOADS.runtime.license, 'Apache-2.0');
});

test('loadVision prefers GPU then falls back to CPU', async () => {
  resetVision();
  const calls: string[] = [];
  const handles = await loadVision(mockRuntime({failGpu: true, calls}));
  assert.equal((handles.segmenter as {delegate: string}).delegate, 'CPU');
  assert.equal((handles.detector as {delegate: string}).delegate, 'CPU');
  assert.ok(calls.some(item => item.startsWith('segmenter:GPU:')));
  assert.ok(calls.some(item => item.startsWith('segmenter:CPU:')));
  assert.equal(visionLoaded(), true);
});

test('loadVision is lazy and reuses the first handles', async () => {
  resetVision();
  const firstCalls: string[] = [];
  const first = await loadVision(mockRuntime({calls: firstCalls}));
  const secondCalls: string[] = [];
  const second = await loadVision(mockRuntime({calls: secondCalls}));
  assert.equal(first, second);
  assert.equal(secondCalls.length, 0);
  assert.ok(firstCalls.length > 0);
});

test.after(() => {
  resetVision();
});
