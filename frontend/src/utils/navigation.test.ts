import { describe, expect, it } from "vitest";
import { findNearestCandle, shouldReplaceWithLatestWindow } from "./candles";
import { goToDateQuery } from "./navigation";

describe("findNearestCandle", () => {
  it("picks the closest openTime without synthesizing rows", () => {
    const rows = [{ openTime: 100 }, { openTime: 300 }, { openTime: 500 }];
    expect(findNearestCandle(rows, 340)?.openTime).toBe(300);
  });
});

describe("goToDateQuery", () => {
  it("requests a bounded window around the anchor, not the full series", () => {
    const query = goToDateQuery(1_640_995_200_000, "1h", 1_502_942_400_000);
    expect(query.limit).toBe(1500);
    expect(query.from).toBeGreaterThan(1_502_942_400_000);
    expect(query.from).toBeLessThan(1_640_995_200_000);
    const spanHours = (1_640_995_200_000 - query.from) / 3_600_000;
    expect(spanHours).toBeLessThanOrEqual(750);
  });
});

describe("shouldReplaceWithLatestWindow", () => {
  it("keeps overlapping history and replaces a disconnected island", () => {
    expect(
      shouldReplaceWithLatestWindow([{ openTime: 1000 }], [{ openTime: 1060 }], 60),
    ).toBe(false);
    expect(
      shouldReplaceWithLatestWindow([{ openTime: 1000 }], [{ openTime: 50_000 }], 60),
    ).toBe(true);
  });
});
