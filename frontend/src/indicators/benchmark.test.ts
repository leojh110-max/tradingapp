import { describe, expect, it } from "vitest";
import { calculateEma } from "./movingAverage/ema";
import { calculateSma } from "./movingAverage/sma";
import { calculateMacd } from "./oscillators/macd";
import { calculateRsi } from "./oscillators/rsi";
import { sequentialSamples } from "./testFixtures";

function samples(count: number) {
  return sequentialSamples(
    Array.from({ length: count }, (_, index) => String(50_000 + (index % 97) + index * 0.25)),
  );
}

function timed(label: string, fn: () => void): number {
  const start = performance.now();
  fn();
  const elapsed = performance.now() - start;
  // eslint-disable-next-line no-console
  console.log(`indicator benchmark ${label}: ${elapsed.toFixed(3)} ms`);
  return elapsed;
}

describe("indicator calculation benchmark", () => {
  it("measures SMA/EMA on 1500, 5000, and 10000 samples", () => {
    const sizes = [1500, 5000, 10000] as const;
    const results: Record<string, number> = {};
    for (const size of sizes) {
      const rows = samples(size);
      results[`sma20_${size}`] = timed(`SMA20 n=${size}`, () => {
        calculateSma(rows, 20);
      });
      results[`sma200_${size}`] = timed(`SMA200 n=${size}`, () => {
        calculateSma(rows, 200);
      });
      results[`ema20_${size}`] = timed(`EMA20 n=${size}`, () => {
        calculateEma(rows, 20);
      });
      results[`ema200_${size}`] = timed(`EMA200 n=${size}`, () => {
        calculateEma(rows, 200);
      });
      results[`rsi14_${size}`] = timed(`RSI14 n=${size}`, () => {
        calculateRsi(rows, 14);
      });
      results[`rsi200_${size}`] = timed(`RSI200 n=${size}`, () => {
        calculateRsi(rows, 200);
      });
      results[`macd12269_${size}`] = timed(`MACD12/26/9 n=${size}`, () => {
        calculateMacd(rows, 12, 26, 9);
      });
      results[`macd5355_${size}`] = timed(`MACD5/35/5 n=${size}`, () => {
        calculateMacd(rows, 5, 35, 5);
      });
    }
    expect(results.sma20_1500).toBeLessThan(250);
    expect(results.ema200_10000).toBeLessThan(2_000);
    expect(results.macd12269_10000).toBeLessThan(2_000);
  });
});
