import assert from 'node:assert/strict';
import test from 'node:test';
import {cutGuides, packPrintSheet, printSheetPixels} from './print-sheet.ts';

test('printSheetPixels is 4×6 inches at the given DPI', () => {
  assert.deepEqual(printSheetPixels(300, false), {width: 1200, height: 1800});
  assert.deepEqual(printSheetPixels(300, true), {width: 1800, height: 1200});
});

test('packPrintSheet tiles copies on a 4×6 sheet and reports leftover', () => {
  const oneInch = {width: Math.round((25 / 25.4) * 300), height: Math.round((35 / 25.4) * 300)};
  const packed = packPrintSheet(
    [{id: 'inch-1', widthPx: oneInch.width, heightPx: oneInch.height, count: 20}],
    {dpi: 300, marginPx: 40, gapPx: 16},
  );
  assert.ok(packed.placements.length >= 8);
  assert.ok(packed.placements.length < 20);
  assert.equal(packed.fitted['inch-1'], packed.placements.length);
  assert.equal(packed.leftover['inch-1'], 20 - packed.placements.length);
  for (const item of packed.placements) {
    assert.ok(item.x + item.width <= packed.sheetWidth);
    assert.ok(item.y + item.height <= packed.sheetHeight);
    assert.ok(item.x >= 0 && item.y >= 0);
  }
});

test('cutGuides emit one rectangle (4 segments) per placement', () => {
  const packed = packPrintSheet(
    [{id: 'tile', widthPx: 200, heightPx: 200, count: 3}],
    {dpi: 300, marginPx: 20, gapPx: 10, forceLandscape: false},
  );
  const guides = cutGuides(packed);
  assert.equal(guides.length, packed.placements.length * 4);
  const first = packed.placements[0]!;
  assert.ok(guides.some(line => line.x1 === first.x && line.y1 === first.y && line.x2 === first.x + first.width));
});

test('mixed sizes keep both ids when they fit', () => {
  const mixed = packPrintSheet(
    [
      {id: 'large', widthPx: 413, heightPx: 531, count: 2},
      {id: 'small', widthPx: 295, heightPx: 413, count: 8},
    ],
    {dpi: 300, marginPx: 36, gapPx: 14},
  );
  assert.ok((mixed.fitted.large ?? 0) >= 1);
  assert.ok((mixed.fitted.small ?? 0) >= 1);
});
