/** Pack N copies onto a 4×6 in sheet at 300 DPI and emit cut-guide segments. */

export const PRINT_SHEET_IN = {width: 4, height: 6} as const;
export const DEFAULT_PRINT_DPI = 300;
export const MM_PER_INCH = 25.4;

export type PrintItem = {id: string; widthPx: number; heightPx: number; count: number};
export type PrintPlacement = {id: string; x: number; y: number; width: number; height: number};
export type CutGuide = {x1: number; y1: number; x2: number; y2: number};
export type PrintPack = {
  sheetWidth: number;
  sheetHeight: number;
  landscape: boolean;
  dpi: number;
  placements: PrintPlacement[];
  fitted: Record<string, number>;
  leftover: Record<string, number>;
};

export function printSheetPixels(dpi = DEFAULT_PRINT_DPI, landscape = false): {width: number; height: number} {
  const width = Math.round(PRINT_SHEET_IN.width * dpi);
  const height = Math.round(PRINT_SHEET_IN.height * dpi);
  return landscape ? {width: height, height: width} : {width, height};
}

function expandItems(items: PrintItem[]): {id: string; width: number; height: number}[] {
  const out: {id: string; width: number; height: number}[] = [];
  for (const item of items) {
    if (item.count < 0 || item.widthPx < 1 || item.heightPx < 1) throw new Error('INVALID_DIMENSIONS');
    for (let i = 0; i < item.count; i += 1) {
      out.push({id: item.id, width: Math.round(item.widthPx), height: Math.round(item.heightPx)});
    }
  }
  return out.sort((a, b) => b.width * b.height - a.width * a.height || b.height - a.height);
}

function packOnce(
  sheetWidth: number,
  sheetHeight: number,
  margin: number,
  gap: number,
  items: {id: string; width: number; height: number}[],
): PrintPlacement[] {
  const placements: PrintPlacement[] = [];
  let x = margin;
  let y = margin;
  let rowHeight = 0;
  for (const item of items) {
    if (item.width + margin * 2 > sheetWidth || item.height + margin * 2 > sheetHeight) continue;
    if (x + item.width > sheetWidth - margin) {
      x = margin;
      y += rowHeight + gap;
      rowHeight = 0;
    }
    if (y + item.height > sheetHeight - margin) continue;
    placements.push({id: item.id, x, y, width: item.width, height: item.height});
    x += item.width + gap;
    rowHeight = Math.max(rowHeight, item.height);
  }
  return placements;
}

export function packPrintSheet(
  items: PrintItem[],
  options?: {dpi?: number; marginPx?: number; gapPx?: number; forceLandscape?: boolean},
): PrintPack {
  const dpi = options?.dpi ?? DEFAULT_PRINT_DPI;
  const margin = options?.marginPx ?? Math.round((4 / MM_PER_INCH) * dpi);
  const gap = options?.gapPx ?? Math.round((2.5 / MM_PER_INCH) * dpi);
  const expanded = expandItems(items);
  const portrait = printSheetPixels(dpi, false);
  const landscape = printSheetPixels(dpi, true);
  const portraitPack = packOnce(portrait.width, portrait.height, margin, gap, expanded);
  const landscapePack = packOnce(landscape.width, landscape.height, margin, gap, expanded);
  const useLandscape =
    options?.forceLandscape === true ||
    (options?.forceLandscape !== false && landscapePack.length > portraitPack.length);
  const placements = useLandscape ? landscapePack : portraitPack;
  const sheet = useLandscape ? landscape : portrait;
  const fitted: Record<string, number> = {};
  const leftover: Record<string, number> = {};
  for (const item of items) {
    fitted[item.id] = placements.filter(entry => entry.id === item.id).length;
    leftover[item.id] = Math.max(0, item.count - (fitted[item.id] ?? 0));
  }
  return {
    sheetWidth: sheet.width,
    sheetHeight: sheet.height,
    landscape: useLandscape,
    dpi,
    placements,
    fitted,
    leftover,
  };
}

/** Hairline rectangle around every placed copy. Draw these after compositing. */
export function cutGuides(pack: PrintPack): CutGuide[] {
  const lines: CutGuide[] = [];
  for (const place of pack.placements) {
    const x2 = place.x + place.width;
    const y2 = place.y + place.height;
    lines.push(
      {x1: place.x, y1: place.y, x2, y2: place.y},
      {x1: x2, y1: place.y, x2, y2},
      {x1: x2, y1: y2, x2: place.x, y2},
      {x1: place.x, y1: y2, x2: place.x, y2: place.y},
    );
  }
  return lines;
}
