import { describe, expect, it } from "vitest";
import { selectionFromClick, chartTypeChangeReloadsData } from "./workspaceState";
import type { Candle } from "../types/market";

const sample: Candle = {
  openTime: 1_640_995_200_000,
  open: "1",
  high: "2",
  low: "1",
  close: "2",
  volume: "3",
};

describe("workspace selection", () => {
  it("opens the inspector only when the setting allows it", () => {
    expect(selectionFromClick(sample, true)).toEqual({
      selectedOpenTime: sample.openTime,
      inspectorOpen: true,
    });
    expect(selectionFromClick(sample, false).inspectorOpen).toBe(false);
  });

  it("does not require a data reload when the chart type changes", () => {
    expect(chartTypeChangeReloadsData()).toBe(false);
  });
});
