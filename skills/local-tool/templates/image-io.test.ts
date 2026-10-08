import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertImageLimits,
  decodeImage,
  exportCanvas,
  IMAGE_BYTE_LIMIT,
  orientedSize,
  parseHexColor,
  readJpegOrientation,
  type DecodeHost,
} from './image-io.ts';

function jpegWithOrientation(orientation: number): Uint8Array {
  return Uint8Array.from([
    0xff, 0xd8,
    0xff, 0xe1, 0x00, 0x22,
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
    0x01, 0x00,
    0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, orientation, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0xff, 0xd9,
  ]);
}

test('readJpegOrientation reads EXIF 6 and leaves non-JPEG as 1', () => {
  assert.equal(readJpegOrientation(jpegWithOrientation(6)), 6);
  assert.equal(readJpegOrientation(jpegWithOrientation(1)), 1);
  assert.equal(readJpegOrientation(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), 1);
});

test('orientedSize swaps edges for EXIF 5–8', () => {
  assert.deepEqual(orientedSize(100, 200, 1), {width: 100, height: 200});
  assert.deepEqual(orientedSize(100, 200, 6), {width: 200, height: 100});
  assert.deepEqual(orientedSize(100, 200, 8), {width: 200, height: 100});
});

test('assertImageLimits rejects oversized files and pixel counts', () => {
  assert.doesNotThrow(() => assertImageLimits(100, 100, 1024));
  assert.throws(() => assertImageLimits(100, 100, IMAGE_BYTE_LIMIT + 1), /FILE_TOO_LARGE/);
  assert.throws(() => assertImageLimits(9000, 10), /TOO_MANY_PIXELS/);
  assert.throws(() => assertImageLimits(0, 10), /UNSUPPORTED_TYPE/);
});

test('parseHexColor accepts #RGB and #RRGGBB', () => {
  assert.deepEqual(parseHexColor('#FFF'), {r: 255, g: 255, b: 255});
  assert.deepEqual(parseHexColor('#3A8DDE'), {r: 58, g: 141, b: 222});
  assert.throws(() => parseHexColor('blue'), /INVALID_COLOR/);
});

test('decodeImage honors orientation when the host does not apply it', async () => {
  const file = new Blob([jpegWithOrientation(6)], {type: 'image/jpeg'});
  const host: DecodeHost = {
    appliesOrientation: false,
    async createBitmap() {
      return {width: 100, height: 200};
    },
  };
  const decoded = await decodeImage(file, host);
  assert.equal(decoded.orientation, 6);
  assert.deepEqual({width: decoded.width, height: decoded.height}, {width: 200, height: 100});
});

test('decodeImage keeps host dimensions when the host applies orientation', async () => {
  const file = new Blob([jpegWithOrientation(6)], {type: 'image/jpeg'});
  const decoded = await decodeImage(file, {
    appliesOrientation: true,
    async createBitmap() {
      return {width: 200, height: 100};
    },
  });
  assert.deepEqual({width: decoded.width, height: decoded.height}, {width: 200, height: 100});
});

test('exportCanvas passes mime and quality to the injected encoder', async () => {
  const encoded = await exportCanvas(
    {width: 64, height: 64},
    {
      async toBlob(source, mime) {
        return {size: source.width * source.height, type: mime};
      },
    },
    'image/jpeg',
    0.8,
  );
  assert.equal(encoded.size, 4096);
  assert.equal(encoded.type, 'image/jpeg');
});
