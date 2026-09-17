export const CHART_SETTINGS_KEY = "chart.settings.v1";

export const CHART_TYPES = ["candles", "bar", "line", "area"] as const;
export type ChartType = (typeof CHART_TYPES)[number];

export type ChartSettings = {
  chartType: ChartType;
  showGrid: boolean;
  showVolume: boolean;
  showCrosshair: boolean;
  upColor: string;
  downColor: string;
  autoScale: boolean;
  logScale: boolean;
  showInspector: boolean;
};

export const DEFAULT_CHART_SETTINGS: ChartSettings = {
  chartType: "candles",
  showGrid: true,
  showVolume: true,
  showCrosshair: true,
  upColor: "#3dd68c",
  downColor: "#f0616d",
  autoScale: true,
  logScale: false,
  showInspector: true,
};

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const HEX = /^#[0-9a-fA-F]{6}$/u;

export function parseChartSettings(raw: unknown): ChartSettings {
  if (typeof raw !== "object" || raw === null) {
    return { ...DEFAULT_CHART_SETTINGS };
  }
  const row = raw as Record<string, unknown>;
  return {
    chartType: isChartType(row.chartType) ? row.chartType : DEFAULT_CHART_SETTINGS.chartType,
    showGrid: bool(row.showGrid, DEFAULT_CHART_SETTINGS.showGrid),
    showVolume: bool(row.showVolume, DEFAULT_CHART_SETTINGS.showVolume),
    showCrosshair: bool(row.showCrosshair, DEFAULT_CHART_SETTINGS.showCrosshair),
    upColor: isHex(row.upColor) ? row.upColor : DEFAULT_CHART_SETTINGS.upColor,
    downColor: isHex(row.downColor) ? row.downColor : DEFAULT_CHART_SETTINGS.downColor,
    autoScale: bool(row.autoScale, DEFAULT_CHART_SETTINGS.autoScale),
    logScale: bool(row.logScale, DEFAULT_CHART_SETTINGS.logScale),
    showInspector: bool(row.showInspector, DEFAULT_CHART_SETTINGS.showInspector),
  };
}

export function loadChartSettings(storage: StorageLike | null = defaultStorage()): ChartSettings {
  if (storage === null) {
    return { ...DEFAULT_CHART_SETTINGS };
  }
  try {
    const raw = storage.getItem(CHART_SETTINGS_KEY);
    if (!raw) {
      return { ...DEFAULT_CHART_SETTINGS };
    }
    return parseChartSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_CHART_SETTINGS };
  }
}

export function saveChartSettings(
  settings: ChartSettings,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (storage === null) {
    return;
  }
  storage.setItem(CHART_SETTINGS_KEY, JSON.stringify(settings));
}

function defaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage === "undefined") {
      return null;
    }
    return localStorage;
  } catch {
    return null;
  }
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function isChartType(value: unknown): value is ChartType {
  return typeof value === "string" && (CHART_TYPES as readonly string[]).includes(value);
}

function isHex(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}
