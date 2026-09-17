import { describe, expect, it } from "vitest";
import { clampVisibleTimeRange, TIMEFRAMES } from "./timeframes";

describe("timeframes", () => {
  it("lists every supported interval including 10m and 30m", () => {
    expect(TIMEFRAMES).toEqual(["1m", "5m", "10m", "15m", "30m", "1h", "4h", "1d"]);
  });

  it("keeps a wide 1m view when switching to 1h would show too few bars", () => {
    const hour = 3_600_000;
    const mid = Date.UTC(2021, 4, 19, 12, 0, 0);
    const requested = { from: mid, to: mid + 3 * 60_000 };
    const result = clampVisibleTimeRange(requested, hour, mid - 200 * hour, mid + hour);
    expect(result).not.toBeNull();
    const bars = (result!.to - result!.from) / hour;
    expect(bars).toBeGreaterThan(50);
  });
});
