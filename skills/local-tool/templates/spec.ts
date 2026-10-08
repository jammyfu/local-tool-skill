/** Generic spec contract for a local tool. Unknown official values stay null. */

export const MM_PER_INCH = 25.4;
export const DEFAULT_DPI = 300;

export type LocalizedText = {en: string; zh: string} & Record<string, string>;
export type OfficialSource = {url: string; title: string; checked: string};
export type PixelSize = {width: number | null; height: number | null};
export type PrintMm = {width: number | null; height: number | null};
export type FileRule = {formats: string[] | null; minKb: number | null; maxKb: number | null};
export type SpecStatus = 'verified' | 'needs-review';

export type ToolSpec = {
  id: string;
  name: LocalizedText;
  notes: LocalizedText;
  sources: OfficialSource[];
  size: {
    pixels: PixelSize;
    printMm: PrintMm;
    dpi: number | null;
  };
  file: FileRule;
  status: SpecStatus;
};

export type ToolSpecBundle = {version: string; generated: string; specs: ToolSpec[]};

export type CustomSize =
  | {mode: 'px'; width: number; height: number; dpi?: number | null}
  | {mode: 'mm'; width: number; height: number; dpi: number};

export type ResolvedSize = {
  width: number;
  height: number;
  dpi: number | null;
  assumedDpi: boolean;
  source: 'pixels' | 'print-mm' | 'custom';
};

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SEMVER = /^\d+\.\d+\.\d+$/;

function fail(message: string): never {
  throw new Error(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} is required`);
  return value.trim();
}

function optionalNumber(value: unknown, label: string, opts?: {min?: number; max?: number}): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${label} must be a finite number or null`);
  if (opts?.min !== undefined && value < opts.min) fail(`${label} must be >= ${opts.min}`);
  if (opts?.max !== undefined && value > opts.max) fail(`${label} must be <= ${opts.max}`);
  return value;
}

function localizedText(value: unknown, label: string): LocalizedText {
  if (!isRecord(value)) fail(`${label} must be an object`);
  const en = requiredString(value.en, `${label}.en`);
  const zh = requiredString(value.zh, `${label}.zh`);
  const text: LocalizedText = {en, zh};
  for (const [key, item] of Object.entries(value)) {
    if (key === 'en' || key === 'zh' || item === undefined) continue;
    text[key] = requiredString(item, `${label}.${key}`);
  }
  return text;
}

function pair(value: unknown, label: string, range?: {min?: number; max?: number}): {width: number | null; height: number | null} {
  if (value === null || value === undefined) return {width: null, height: null};
  if (!isRecord(value)) fail(`${label} must be an object or null`);
  return {
    width: optionalNumber(value.width, `${label}.width`, range),
    height: optionalNumber(value.height, `${label}.height`, range),
  };
}

function parseFile(value: unknown): FileRule {
  if (value === null || value === undefined) return {formats: null, minKb: null, maxKb: null};
  if (!isRecord(value)) fail('file must be an object or null');
  const minKb = optionalNumber(value.minKb ?? value.min_kb, 'file.minKb', {min: 1, max: 100_000});
  const maxKb = optionalNumber(value.maxKb ?? value.max_kb, 'file.maxKb', {min: 1, max: 100_000});
  if (minKb !== null && maxKb !== null && minKb > maxKb) fail('file.minKb must be <= file.maxKb');
  let formats: string[] | null = null;
  const raw = value.formats;
  if (raw !== null && raw !== undefined) {
    if (!Array.isArray(raw) || raw.some(item => typeof item !== 'string' || !item)) {
      fail('file.formats must be a string array or null');
    }
    formats = raw.length ? raw.map(item => String(item).toLowerCase()) : null;
  }
  return {formats, minKb, maxKb};
}

export function parseToolSpec(value: unknown): ToolSpec {
  if (!isRecord(value)) fail('spec must be an object');
  const id = requiredString(value.id, 'id');
  if (!ID.test(id)) fail(`id must be kebab-case: ${id}`);
  const status = requiredString(value.status, 'status');
  if (status !== 'verified' && status !== 'needs-review') fail(`unknown status: ${status}`);
  if (!Array.isArray(value.sources) || value.sources.length < 1) fail('sources must contain at least one official URL');
  const sources = value.sources.map((item, index) => {
    if (!isRecord(item)) fail(`sources[${index}] must be an object`);
    const url = requiredString(item.url, `sources[${index}].url`);
    if (!/^https:\/\//.test(url)) fail(`sources[${index}].url must be https`);
    const checked = requiredString(item.checked, `sources[${index}].checked`);
    if (!ISO_DATE.test(checked)) fail(`sources[${index}].checked must be YYYY-MM-DD`);
    return {url, title: requiredString(item.title, `sources[${index}].title`), checked};
  });
  const size = isRecord(value.size) ? value.size : fail('size must be an object');
  const printRaw = size.printMm ?? size.print_mm;
  return {
    id,
    name: localizedText(value.name, 'name'),
    notes: localizedText(value.notes, 'notes'),
    sources,
    size: {
      pixels: pair(size.pixels, 'size.pixels', {min: 1, max: 8192}),
      printMm: pair(printRaw, 'size.printMm', {min: 1, max: 400}),
      dpi: optionalNumber(size.dpi, 'size.dpi', {min: 72, max: 1200}),
    },
    file: parseFile(value.file),
    status,
  };
}

export function parseToolSpecBundle(value: unknown): ToolSpecBundle {
  if (!isRecord(value)) fail('bundle must be an object');
  const version = requiredString(value.version, 'version');
  if (!SEMVER.test(version)) fail('version must be semver');
  const generated = requiredString(value.generated, 'generated');
  if (!ISO_DATE.test(generated) && Number.isNaN(Date.parse(generated))) fail('generated must be a date');
  if (!Array.isArray(value.specs)) fail('specs must be an array');
  const specs = value.specs.map(parseToolSpec).sort((a, b) => a.id.localeCompare(b.id));
  const ids = new Set<string>();
  for (const spec of specs) {
    if (ids.has(spec.id)) fail(`duplicate spec id: ${spec.id}`);
    ids.add(spec.id);
  }
  return {version, generated, specs};
}

export function mmToPx(mm: number, dpi: number): number {
  if (![mm, dpi].every(Number.isFinite) || mm <= 0 || dpi <= 0) fail('mm and dpi must be positive');
  return Math.max(1, Math.round((mm / MM_PER_INCH) * dpi));
}

export function pxToMm(px: number, dpi: number): number {
  if (![px, dpi].every(Number.isFinite) || px <= 0 || dpi <= 0) fail('px and dpi must be positive');
  return (px / dpi) * MM_PER_INCH;
}

export function resolveOutputSize(
  spec: ToolSpec | null | undefined,
  custom?: CustomSize | null,
  dpiFallback = DEFAULT_DPI,
): ResolvedSize {
  if (custom) {
    if (custom.mode === 'px') {
      const width = Math.round(custom.width);
      const height = Math.round(custom.height);
      if (width < 1 || height < 1 || width > 8192 || height > 8192) fail('custom pixel size is out of range');
      return {width, height, dpi: custom.dpi ?? null, assumedDpi: false, source: 'custom'};
    }
    return {
      width: mmToPx(custom.width, custom.dpi),
      height: mmToPx(custom.height, custom.dpi),
      dpi: custom.dpi,
      assumedDpi: false,
      source: 'custom',
    };
  }
  if (!spec) fail('spec does not define an export size');
  const {pixels, printMm, dpi} = spec.size;
  if (pixels.width && pixels.height) {
    return {width: pixels.width, height: pixels.height, dpi, assumedDpi: false, source: 'pixels'};
  }
  if (printMm.width && printMm.height) {
    const usedDpi = dpi ?? dpiFallback;
    return {
      width: mmToPx(printMm.width, usedDpi),
      height: mmToPx(printMm.height, usedDpi),
      dpi: usedDpi,
      assumedDpi: dpi === null,
      source: 'print-mm',
    };
  }
  fail('spec does not define an export size');
}

export function pickLocale(text: LocalizedText, locale: string): string {
  if (locale === 'zh' || locale.startsWith('zh-Hans')) return text.zh;
  if (locale.startsWith('zh-Hant')) return text['zh-Hant'] ?? text.zh;
  return text[locale] ?? text.en;
}
