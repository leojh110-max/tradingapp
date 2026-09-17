import {
  INDICATOR_INSTANCE_LIMIT,
  INDICATOR_PERIOD_MAX,
  INDICATOR_PERIOD_MIN,
  INDICATOR_SOURCES,
  INDICATOR_TYPES,
  MACD_DEFAULT_HIST_NEGATIVE,
  MACD_DEFAULT_HIST_POSITIVE,
  MACD_DEFAULT_SIGNAL_COLOR,
  type IndicatorInstance,
  type IndicatorSource,
  type IndicatorTypeId,
} from "./types";

export function parsePeriod(raw: string, label = "Period"): { ok: true; value: number } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: false, message: `Enter a ${label.toLowerCase()}.` };
  }
  if (!/^\d+$/u.test(trimmed)) {
    return { ok: false, message: `${label} must be a whole number.` };
  }
  const value = Number(trimmed);
  if (value < INDICATOR_PERIOD_MIN) {
    return { ok: false, message: `${label} must be at least ${INDICATOR_PERIOD_MIN}.` };
  }
  if (value > INDICATOR_PERIOD_MAX) {
    return { ok: false, message: `${label} must be at most ${INDICATOR_PERIOD_MAX}.` };
  }
  return { ok: true, value };
}

export function parseMacdLengths(
  fastRaw: string,
  slowRaw: string,
  signalRaw: string,
): { ok: true; fastPeriod: number; slowPeriod: number; signalPeriod: number } | { ok: false; message: string } {
  const fast = parsePeriod(fastRaw, "Fast length");
  if (!fast.ok) {
    return fast;
  }
  const slow = parsePeriod(slowRaw, "Slow length");
  if (!slow.ok) {
    return slow;
  }
  const signal = parsePeriod(signalRaw, "Signal length");
  if (!signal.ok) {
    return signal;
  }
  if (!(fast.value < slow.value)) {
    return { ok: false, message: "Fast length must be smaller than slow length." };
  }
  return { ok: true, fastPeriod: fast.value, slowPeriod: slow.value, signalPeriod: signal.value };
}

export function parseLevel(raw: string, label: string): { ok: true; value: number } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: false, message: `Enter an ${label.toLowerCase()} level.` };
  }
  if (!/^\d+(\.\d{1,2})?$/u.test(trimmed)) {
    return { ok: false, message: `${label} must be a number from 0 to 100.` };
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return { ok: false, message: `${label} must be between 0 and 100.` };
  }
  return { ok: true, value };
}

export function parseRsiLevels(
  oversoldRaw: string,
  overboughtRaw: string,
): { ok: true; oversold: number; overbought: number } | { ok: false; message: string } {
  const oversold = parseLevel(oversoldRaw, "Oversold");
  if (!oversold.ok) {
    return oversold;
  }
  const overbought = parseLevel(overboughtRaw, "Overbought");
  if (!overbought.ok) {
    return overbought;
  }
  if (!(oversold.value < overbought.value)) {
    return { ok: false, message: "Oversold must be less than overbought." };
  }
  return { ok: true, oversold: oversold.value, overbought: overbought.value };
}

export function isIndicatorSource(value: unknown): value is IndicatorSource {
  return typeof value === "string" && (INDICATOR_SOURCES as readonly string[]).includes(value);
}

export function isIndicatorType(value: unknown): value is IndicatorTypeId {
  return typeof value === "string" && (INDICATOR_TYPES as readonly string[]).includes(value);
}

export function canAddInstance(count: number): { ok: true } | { ok: false; message: string } {
  if (count >= INDICATOR_INSTANCE_LIMIT) {
    return { ok: false, message: `At most ${INDICATOR_INSTANCE_LIMIT} indicators can be active.` };
  }
  return { ok: true };
}

const HEX = /^#[0-9a-fA-F]{6}$/u;

export function parseStoredInstances(raw: unknown): IndicatorInstance[] {
  if (typeof raw !== "object" || raw === null) {
    return [];
  }
  const row = raw as { instances?: unknown };
  if (!Array.isArray(row.instances)) {
    return [];
  }
  const parsed: IndicatorInstance[] = [];
  for (const item of row.instances) {
    const instance = parseInstance(item);
    if (instance) {
      parsed.push(instance);
    }
  }
  return parsed.slice(0, INDICATOR_INSTANCE_LIMIT);
}

function parseInstance(raw: unknown): IndicatorInstance | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string" || row.id.length === 0) {
    return null;
  }
  if (!isIndicatorType(row.type)) {
    return null;
  }
  if (typeof row.period !== "number" || !Number.isInteger(row.period)) {
    return null;
  }
  if (row.period < INDICATOR_PERIOD_MIN || row.period > INDICATOR_PERIOD_MAX) {
    return null;
  }
  if (!isIndicatorSource(row.source)) {
    return null;
  }
  if (typeof row.color !== "string" || !HEX.test(row.color)) {
    return null;
  }
  if (typeof row.lineWidth !== "number" || !Number.isInteger(row.lineWidth) || row.lineWidth < 1 || row.lineWidth > 4) {
    return null;
  }
  const instance: IndicatorInstance = {
    id: row.id,
    type: row.type,
    period: row.period,
    source: row.source,
    color: row.color,
    lineWidth: row.lineWidth,
    visible: typeof row.visible === "boolean" ? row.visible : true,
  };
  if (row.type === "rsi") {
    const overbought = optionalLevel(row.overbought, 70);
    const oversold = optionalLevel(row.oversold, 30);
    if (overbought === null || oversold === null || !(oversold < overbought)) {
      instance.overbought = 70;
      instance.oversold = 30;
    } else {
      instance.overbought = overbought;
      instance.oversold = oversold;
    }
  }
  if (row.type === "macd") {
    const lengths = parseStoredMacdLengths(row);
    if (!lengths) {
      return null;
    }
    instance.fastPeriod = lengths.fastPeriod;
    instance.slowPeriod = lengths.slowPeriod;
    instance.signalPeriod = lengths.signalPeriod;
    instance.period = lengths.slowPeriod;
    instance.signalColor = optionalHex(row.signalColor, MACD_DEFAULT_SIGNAL_COLOR);
    instance.histogramPositiveColor = optionalHex(row.histogramPositiveColor, MACD_DEFAULT_HIST_POSITIVE);
    instance.histogramNegativeColor = optionalHex(row.histogramNegativeColor, MACD_DEFAULT_HIST_NEGATIVE);
  }
  return instance;
}

function parseStoredMacdLengths(
  row: Record<string, unknown>,
): { fastPeriod: number; slowPeriod: number; signalPeriod: number } | null {
  const fastPeriod = optionalPeriod(row.fastPeriod);
  const slowPeriod = optionalPeriod(row.slowPeriod);
  const signalPeriod = optionalPeriod(row.signalPeriod);
  if (fastPeriod === null || slowPeriod === null || signalPeriod === null) {
    return null;
  }
  if (!(fastPeriod < slowPeriod)) {
    return null;
  }
  return { fastPeriod, slowPeriod, signalPeriod };
}

function optionalPeriod(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isInteger(raw)) {
    return null;
  }
  if (raw < INDICATOR_PERIOD_MIN || raw > INDICATOR_PERIOD_MAX) {
    return null;
  }
  return raw;
}

function optionalHex(raw: unknown, fallback: string): string {
  if (typeof raw === "string" && HEX.test(raw)) {
    return raw;
  }
  return fallback;
}

function optionalLevel(raw: unknown, fallback: number): number | null {
  if (raw === undefined) {
    return fallback;
  }
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0 || raw > 100) {
    return null;
  }
  return raw;
}
