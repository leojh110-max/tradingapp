import { describe, expect, it } from "vitest";
import {
  CHART_SETTINGS_KEY,
  DEFAULT_CHART_SETTINGS,
  loadChartSettings,
  parseChartSettings,
  saveChartSettings,
  type StorageLike,
} from "./chartSettings";

function memoryStorage(initial?: Record<string, string>): StorageLike {
  const store = new Map(Object.entries(initial ?? {}));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
  };
}

describe("chart settings", () => {
  it("returns built-in defaults", () => {
    expect(loadChartSettings(memoryStorage())).toEqual(DEFAULT_CHART_SETTINGS);
    expect(DEFAULT_CHART_SETTINGS.chartType).toBe("candles");
    expect(DEFAULT_CHART_SETTINGS.showGrid).toBe(true);
    expect(DEFAULT_CHART_SETTINGS.showVolume).toBe(true);
    expect(DEFAULT_CHART_SETTINGS.logScale).toBe(false);
  });

  it("persists and reloads a versioned key", () => {
    const storage = memoryStorage();
    saveChartSettings({ ...DEFAULT_CHART_SETTINGS, logScale: true, chartType: "line" }, storage);
    const raw = storage.getItem(CHART_SETTINGS_KEY);
    expect(raw).toContain("\"logScale\":true");
    expect(loadChartSettings(storage).chartType).toBe("line");
    expect(loadChartSettings(storage).logScale).toBe(true);
  });

  it("falls back when localStorage JSON is invalid", () => {
    const storage = memoryStorage({ [CHART_SETTINGS_KEY]: "{not-json" });
    expect(loadChartSettings(storage)).toEqual(DEFAULT_CHART_SETTINGS);
  });

  it("ignores unknown fields and bad colors", () => {
    const parsed = parseChartSettings({
      chartType: "fibonacci",
      upColor: "red",
      showVolume: false,
      extra: true,
    });
    expect(parsed.chartType).toBe("candles");
    expect(parsed.upColor).toBe(DEFAULT_CHART_SETTINGS.upColor);
    expect(parsed.showVolume).toBe(false);
  });
});
