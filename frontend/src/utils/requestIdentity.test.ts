import { describe, expect, it } from "vitest";
import { isCurrentRequest, nextRequestId, timeframeButtonState } from "./requestIdentity";

describe("timeframe request identity", () => {
  it("ignores stale responses", () => {
    const first = nextRequestId(0);
    const second = nextRequestId(first);
    expect(isCurrentRequest(second, first)).toBe(false);
    expect(isCurrentRequest(second, second)).toBe(true);
  });

  it("marks the pending timeframe as selected and loading", () => {
    expect(timeframeButtonState("1d", "4h", "1d")).toEqual({ selected: true, loading: true });
    expect(timeframeButtonState("4h", "4h", "1d")).toEqual({ selected: false, loading: false });
    expect(timeframeButtonState("4h", "4h", null)).toEqual({ selected: true, loading: false });
  });
});
