/** Binary-search encoder quality to a KB window, then downscale if still too large. */

export type CompressTarget = {
  minBytes?: number | null;
  maxBytes?: number | null;
};

export type CompressEncode<T extends {size: number}> = (
  quality: number,
  width: number,
  height: number,
) => Promise<T>;

export type CompressResult<T extends {size: number} = {size: number}> = {
  result: T;
  quality: number;
  width: number;
  height: number;
  bytes: number;
  downscaled: boolean;
};

const MIN_QUALITY = 0.12;
const MAX_QUALITY = 0.95;
const SEARCH_STEPS = 8;
const SCALE_STEP = 0.92;
const MIN_SCALE = 0.55;

function clampQuality(value: number): number {
  return Math.min(MAX_QUALITY, Math.max(MIN_QUALITY, value));
}

function inRange(size: number, minBytes: number, maxBytes: number): boolean {
  return size >= minBytes && size <= maxBytes;
}

function better(candidate: number, current: number, minBytes: number, maxBytes: number): boolean {
  const candidateOk = inRange(candidate, minBytes, maxBytes);
  const currentOk = inRange(current, minBytes, maxBytes);
  if (candidateOk && currentOk) return candidate >= current;
  if (candidateOk !== currentOk) return candidateOk;
  if (current > maxBytes && candidate > maxBytes) return candidate < current;
  if (current < minBytes && candidate < minBytes) return candidate > current;
  return candidate <= maxBytes && current > maxBytes;
}

async function searchQuality<T extends {size: number}>(
  encode: CompressEncode<T>,
  width: number,
  height: number,
  target: CompressTarget,
): Promise<{result: T; quality: number}> {
  const maxBytes = target.maxBytes ?? Number.POSITIVE_INFINITY;
  const minBytes = target.minBytes ?? 0;
  let low = MIN_QUALITY;
  let high = MAX_QUALITY;
  let best = await encode(high, width, height);
  let bestQuality = high;
  if (target.maxBytes == null && target.minBytes == null) {
    return {result: best, quality: bestQuality};
  }

  for (let step = 0; step < SEARCH_STEPS; step += 1) {
    const mid = (low + high) / 2;
    const next = await encode(mid, width, height);
    if (better(next.size, best.size, minBytes, maxBytes)) {
      best = next;
      bestQuality = mid;
    }
    if (next.size > maxBytes) high = mid;
    else low = mid;
  }

  if (best.size < minBytes && bestQuality < MAX_QUALITY) {
    const raised = await encode(MAX_QUALITY, width, height);
    if (better(raised.size, best.size, minBytes, maxBytes)) {
      best = raised;
      bestQuality = MAX_QUALITY;
    }
  }
  return {result: best, quality: clampQuality(bestQuality)};
}

export async function compressToTarget<T extends {size: number}>(
  encode: CompressEncode<T>,
  width: number,
  height: number,
  target: CompressTarget,
  options?: {minScale?: number; scaleStep?: number},
): Promise<CompressResult<T>> {
  if (width < 1 || height < 1) throw new Error('INVALID_DIMENSIONS');
  const minScale = options?.minScale ?? MIN_SCALE;
  const scaleStep = options?.scaleStep ?? SCALE_STEP;
  let currentW = Math.round(width);
  let currentH = Math.round(height);
  let downscaled = false;
  let search = await searchQuality(encode, currentW, currentH, target);
  const maxBytes = target.maxBytes;

  while (maxBytes && search.result.size > maxBytes && currentW * minScale >= 32 && currentH * minScale >= 32) {
    const nextW = Math.max(32, Math.round(currentW * scaleStep));
    const nextH = Math.max(32, Math.round(currentH * scaleStep));
    if (nextW === currentW && nextH === currentH) break;
    currentW = nextW;
    currentH = nextH;
    downscaled = true;
    search = await searchQuality(encode, currentW, currentH, target);
  }

  return {
    result: search.result,
    quality: search.quality,
    width: currentW,
    height: currentH,
    bytes: search.result.size,
    downscaled,
  };
}

export function kbRangeToBytes(minKb?: number | null, maxKb?: number | null): CompressTarget {
  return {
    minBytes: minKb ? Math.round(minKb * 1024) : null,
    maxBytes: maxKb ? Math.round(maxKb * 1024) : null,
  };
}

export async function compressToKb<T extends {size: number}>(
  encode: CompressEncode<T>,
  width: number,
  height: number,
  range: {minKb?: number | null; maxKb?: number | null},
  options?: {minScale?: number; scaleStep?: number},
): Promise<CompressResult<T>> {
  return compressToTarget(encode, width, height, kbRangeToBytes(range.minKb, range.maxKb), options);
}

export function formatKib(bytes: number): string {
  const kib = Math.max(0, bytes / 1024);
  return `${kib.toFixed(bytes >= 100 * 1024 ? 0 : 1)} KB`;
}
