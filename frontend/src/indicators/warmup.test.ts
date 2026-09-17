import { describe, expect, it } from "vitest";
import { emaWarmupExtra, emaWarmupPrior, macdWarmupPrior, rsiWarmupExtra, rsiWarmupPrior, smaWarmupPrior, warmupPriorFor } from "./warmup";
import { instance } from "./testFixtures";

describe("warm-up priors", () => {
  it("requires N-1 actual SMA samples before the first output", () => {
    expect(smaWarmupPrior(20)).toBe(19);
    expect(smaWarmupPrior(1)).toBe(0);
  });

  it("uses seed-weight 1e-8 to size EMA extra samples", () => {
    expect(emaWarmupExtra(1)).toBe(0);
    expect(emaWarmupExtra(3)).toBe(27);
    expect(emaWarmupExtra(20)).toBe(185);
    expect(emaWarmupExtra(200)).toBe(1843);
    expect(emaWarmupPrior(20)).toBe(204);
    expect(emaWarmupPrior(200)).toBe(2042);
  });

  it("uses Wilder decay (N-1)/N and 1e-8 seed weight for RSI extra samples", () => {
    expect(rsiWarmupExtra(1)).toBe(0);
    expect(rsiWarmupExtra(14)).toBe(249);
    expect(rsiWarmupPrior(14)).toBe(263);
    expect(rsiWarmupPrior(200)).toBe(3875);
  });

  it("sizes MACD prior from Slow EMA and Signal EMA 1e-8 bounds, not a magic slow*10", () => {
    expect(macdWarmupPrior(12, 26, 9)).toBe(emaWarmupPrior(26) + emaWarmupPrior(9));
    expect(macdWarmupPrior(12, 26, 9)).toBe(356);
    expect(macdWarmupPrior(5, 35, 5)).toBe(emaWarmupPrior(35) + emaWarmupPrior(5));
    expect(macdWarmupPrior(12, 26, 9)).toBe(warmupPriorFor(instance({ id: "m", type: "macd" })));
    expect(macdWarmupPrior(12, 26, 9)).not.toBe(26 * 10);
  });
});
