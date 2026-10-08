/** Decode still images (honor EXIF orientation) and export a canvas. Inject the host. */

export const IMAGE_BYTE_LIMIT = 20 * 1024 * 1024;
export const IMAGE_PIXEL_LIMIT = 40_000_000;
export const IMAGE_EDGE_LIMIT = 8192;

export type ExportMime = 'image/jpeg' | 'image/png';
export type BitmapLike = {width: number; height: number; close?: () => void};
export type EncodedBytes = {size: number; type: ExportMime};

export type DecodeHost = {
  /** Browser: createImageBitmap(blob, {imageOrientation: 'from-image'}). */
  createBitmap: (file: Blob, options: {imageOrientation: 'from-image'}) => Promise<BitmapLike>;
  /** True when the host already swapped width/height for EXIF 5–8. */
  appliesOrientation?: boolean;
};

export type CanvasExportHost = {
  toBlob: (
    source: {width: number; height: number},
    mime: ExportMime,
    quality?: number,
  ) => Promise<EncodedBytes>;
};

const SWAP = new Set([5, 6, 7, 8]);

export function assertImageLimits(width: number, height: number, bytes?: number): void {
  if (bytes !== undefined && bytes > IMAGE_BYTE_LIMIT) throw new Error('FILE_TOO_LARGE');
  if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error('UNSUPPORTED_TYPE');
  }
  if (width * height > IMAGE_PIXEL_LIMIT || width > IMAGE_EDGE_LIMIT || height > IMAGE_EDGE_LIMIT) {
    throw new Error('TOO_MANY_PIXELS');
  }
}

export function orientedSize(width: number, height: number, orientation: number): {width: number; height: number} {
  if (SWAP.has(orientation)) return {width: height, height: width};
  return {width, height};
}

function u16(bytes: Uint8Array, offset: number, little: boolean): number {
  return little ? bytes[offset]! | (bytes[offset + 1]! << 8) : (bytes[offset]! << 8) | bytes[offset + 1]!;
}

function u32(bytes: Uint8Array, offset: number, little: boolean): number {
  return little
    ? bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16) | (bytes[offset + 3]! << 24)
    : (bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!;
}

function readTiffOrientation(tiff: Uint8Array): number | null {
  if (tiff.length < 12) return null;
  const little = tiff[0] === 0x49 && tiff[1] === 0x49;
  const big = tiff[0] === 0x4d && tiff[1] === 0x4d;
  if (!little && !big) return null;
  if (u16(tiff, 2, little) !== 42) return null;
  const ifd = u32(tiff, 4, little);
  if (ifd + 2 > tiff.length) return null;
  const count = u16(tiff, ifd, little);
  for (let i = 0; i < count; i += 1) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > tiff.length) break;
    if (u16(tiff, entry, little) === 0x0112) {
      const value = u16(tiff, entry + 8, little);
      if (value >= 1 && value <= 8) return value;
    }
  }
  return null;
}

/** Read JPEG EXIF orientation (1–8). Non-JPEG or missing tag returns 1. */
export function readJpegOrientation(bytes: Uint8Array): number {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1]!;
    const size = (bytes[offset + 2]! << 8) | bytes[offset + 3]!;
    if (marker === 0xe1 && size >= 8) {
      const start = offset + 4;
      if (
        bytes[start] === 0x45 &&
        bytes[start + 1] === 0x78 &&
        bytes[start + 2] === 0x69 &&
        bytes[start + 3] === 0x66
      ) {
        const orientation = readTiffOrientation(bytes.subarray(start + 6));
        if (orientation) return orientation;
      }
    }
    if (marker === 0xda) break;
    offset += 2 + size;
  }
  return 1;
}

export async function decodeImage(file: Blob, host: DecodeHost): Promise<{
  width: number;
  height: number;
  orientation: number;
  bitmap: BitmapLike;
}> {
  if (file.size > IMAGE_BYTE_LIMIT) throw new Error('FILE_TOO_LARGE');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const orientation = readJpegOrientation(bytes);
  const bitmap = await host.createBitmap(file, {imageOrientation: 'from-image'});
  try {
    let {width, height} = bitmap;
    if (host.appliesOrientation === false) {
      ({width, height} = orientedSize(width, height, orientation));
    }
    assertImageLimits(width, height, file.size);
    return {width, height, orientation, bitmap};
  } catch (error) {
    bitmap.close?.();
    throw error;
  }
}

export function parseHexColor(hex: string): {r: number; g: number; b: number} {
  const match = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.exec(hex.trim());
  if (!match) throw new Error('INVALID_COLOR');
  let raw = match[1]!;
  if (raw.length === 3) raw = raw.split('').map(part => part + part).join('');
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
  };
}

export async function exportCanvas(
  source: {width: number; height: number},
  host: CanvasExportHost,
  mime: ExportMime = 'image/jpeg',
  quality = 0.92,
): Promise<EncodedBytes> {
  assertImageLimits(source.width, source.height);
  const encoded = await host.toBlob(source, mime, mime === 'image/png' ? undefined : quality);
  if (!encoded?.size) throw new Error('ENCODE_UNSUPPORTED');
  return encoded;
}

/** Thin browser adapter. Uses globalThis so this file typechecks without DOM libs. */
export function browserDecodeHost(): DecodeHost {
  const create = (globalThis as {
    createImageBitmap?: (image: Blob, options?: {imageOrientation?: string}) => Promise<BitmapLike>;
  }).createImageBitmap;
  if (!create) throw new Error('NO_BITMAP_DECODER');
  return {
    appliesOrientation: true,
    createBitmap: (file, options) => create(file, options),
  };
}

export function browserExportHost(): CanvasExportHost {
  return {
    async toBlob(source, mime, quality) {
      const doc = (globalThis as {
        document?: {createElement: (tag: string) => {width: number; height: number; toBlob: Function}};
      }).document;
      if (!doc) throw new Error('NO_DOCUMENT');
      const canvas = doc.createElement('canvas');
      canvas.width = source.width;
      canvas.height = source.height;
      const blob: Blob | null = await new Promise(resolve => {
        canvas.toBlob((next: Blob | null) => resolve(next), mime, quality);
      });
      if (!blob) throw new Error('ENCODE_UNSUPPORTED');
      return {size: blob.size, type: mime};
    },
  };
}
