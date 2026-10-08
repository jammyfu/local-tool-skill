/**
 * Lazy on-device MediaPipe segmenter + face detector.
 * Runtime assets are same-origin. Official model URLs are build-time downloads only.
 */

export const MEDIAPIPE_TASKS_VERSION = '0.10.32';

/** Build-time downloads only. Do not fetch these from the browser. License: Apache-2.0. */
export const MODEL_DOWNLOADS = {
  selfieSegmenter: {
    id: 'mediapipe-selfie-segmenter-float16',
    file: 'selfie_segmenter.tflite',
    license: 'Apache-2.0',
    url: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
    card: 'https://developers.google.com/mediapipe/solutions/vision/image_segmenter',
  },
  blazeFace: {
    id: 'mediapipe-blaze-face-short-range-float16',
    file: 'blaze_face_short_range.tflite',
    license: 'Apache-2.0',
    url: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite',
    card: 'https://developers.google.com/mediapipe/solutions/vision/face_detector',
  },
  runtime: {
    id: 'mediapipe-tasks-vision',
    package: '@mediapipe/tasks-vision',
    version: MEDIAPIPE_TASKS_VERSION,
    license: 'Apache-2.0',
    wasmFrom: 'node_modules/@mediapipe/tasks-vision/wasm/',
  },
} as const;

export type VisionPaths = {
  wasm: string;
  segmenter: string;
  face: string;
};

export type VisionDelegate = 'GPU' | 'CPU';

export type VisionRuntime = {
  fileset: (wasmPath: string) => Promise<unknown>;
  createSegmenter: (
    fileset: unknown,
    options: {modelAssetPath: string; delegate: VisionDelegate},
  ) => Promise<unknown>;
  createDetector: (
    fileset: unknown,
    options: {modelAssetPath: string; delegate: VisionDelegate},
  ) => Promise<unknown>;
};

export type VisionHandles = {
  segmenter: unknown;
  detector: unknown;
};

let pending: Promise<VisionHandles> | null = null;
let handles: VisionHandles | null = null;

export function vendorPaths(version = MEDIAPIPE_TASKS_VERSION): VisionPaths {
  const base = `/vendor/mediapipe/${version}`;
  return {
    wasm: `${base}/wasm`,
    segmenter: `${base}/models/${MODEL_DOWNLOADS.selfieSegmenter.file}`,
    face: `${base}/models/${MODEL_DOWNLOADS.blazeFace.file}`,
  };
}

export function assertSameOriginAsset(path: string): void {
  if (/^https?:\/\//i.test(path) || path.startsWith('//')) throw new Error('REMOTE_ASSET');
}

export function resetVision(): void {
  pending = null;
  handles = null;
}

async function withDelegate<T>(create: (delegate: VisionDelegate) => Promise<T>): Promise<T> {
  try {
    return await create('GPU');
  } catch {
    return create('CPU');
  }
}

async function createHandles(runtime: VisionRuntime, paths: VisionPaths): Promise<VisionHandles> {
  assertSameOriginAsset(paths.wasm);
  assertSameOriginAsset(paths.segmenter);
  assertSameOriginAsset(paths.face);
  const fileset = await runtime.fileset(paths.wasm);
  const [segmenter, detector] = await Promise.all([
    withDelegate(delegate => runtime.createSegmenter(fileset, {modelAssetPath: paths.segmenter, delegate})),
    withDelegate(delegate => runtime.createDetector(fileset, {modelAssetPath: paths.face, delegate})),
  ]);
  handles = {segmenter, detector};
  return handles;
}

/** Load once. GPU first, CPU fallback. Inject MediaPipe (or a test double). */
export async function loadVision(runtime: VisionRuntime, paths: VisionPaths = vendorPaths()): Promise<VisionHandles> {
  if (handles) return handles;
  if (!pending) {
    pending = createHandles(runtime, paths).catch(error => {
      pending = null;
      throw error;
    });
  }
  return pending;
}

export function visionLoaded(): boolean {
  return handles !== null;
}
