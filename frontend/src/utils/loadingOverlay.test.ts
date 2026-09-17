import { describe, expect, it } from "vitest";
import {
  CHART_LOAD_ERROR,
  PRIMARY_LOADING_DELAY_MS,
  PRIMARY_LOADING_MIN_VISIBLE_MS,
  loadingIntervalLabel,
  remainingMinVisibleMs,
  shouldRevealPrimaryOverlay,
} from "./loadingOverlay";

describe("primary loading delay", () => {
  it("hides overlay before the delay threshold", () => {
    expect(shouldRevealPrimaryOverlay(0)).toBe(false);
    expect(shouldRevealPrimaryOverlay(PRIMARY_LOADING_DELAY_MS - 1)).toBe(false);
    expect(shouldRevealPrimaryOverlay(PRIMARY_LOADING_DELAY_MS)).toBe(true);
  });

  it("keeps a shown overlay visible for a minimum duration", () => {
    expect(remainingMinVisibleMs(0)).toBe(PRIMARY_LOADING_MIN_VISIBLE_MS);
    expect(remainingMinVisibleMs(PRIMARY_LOADING_MIN_VISIBLE_MS)).toBe(0);
    expect(remainingMinVisibleMs(PRIMARY_LOADING_MIN_VISIBLE_MS + 20)).toBe(0);
  });

  it("formats overlay copy", () => {
    expect(loadingIntervalLabel("1d")).toBe("1D");
    expect(CHART_LOAD_ERROR).toBe("Unable to load chart data");
  });
});
