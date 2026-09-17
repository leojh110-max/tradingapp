import { describe, expect, it } from "vitest";
import { add, compare, divide, formatDecimal, formatSignedDecimal, fromInteger, multiply, parseDecimal, percentOf, subtract } from "./decimal";

describe("parseDecimal", () => {
  it("keeps API scale without float rounding", () => {
    const value = parseDecimal("71245.20000000");
    expect(value.coeff).toBe(7124520000000n);
    expect(value.scale).toBe(8);
    expect(formatDecimal(value)).toBe("71245.2");
  });
});

describe("subtract", () => {
  it("computes change from original strings", () => {
    const change = subtract(parseDecimal("71840.30"), parseDecimal("71245.20"));
    expect(formatDecimal(change)).toBe("595.1");
    expect(formatSignedDecimal(change)).toBe("+595.1");
  });
});

describe("compare", () => {
  it("treats equal scaled strings as equal", () => {
    expect(compare(parseDecimal("10.0"), parseDecimal("10.00"))).toBe(0);
  });
});

describe("percentOf", () => {
  it("returns null when the denominator is zero", () => {
    expect(percentOf(parseDecimal("1"), parseDecimal("0"))).toBeNull();
  });

  it("rounds half-up to four decimal places", () => {
    expect(percentOf(parseDecimal("595.10"), parseDecimal("71245.20"))).toBe("0.8353");
  });
});

describe("add", () => {
  it("aligns different scales", () => {
    expect(formatDecimal(add(parseDecimal("1.5"), parseDecimal("0.25")))).toBe("1.75");
  });
});

describe("multiply and divide", () => {
  it("multiplies BTC-scale values without binary float", () => {
    expect(formatDecimal(multiply(parseDecimal("71245.20"), fromInteger(2)))).toBe("142490.4");
  });

  it("divides with half-up rounding at a requested scale", () => {
    expect(formatDecimal(divide(parseDecimal("10"), fromInteger(4), 2))).toBe("2.5");
    expect(formatDecimal(divide(parseDecimal("1"), fromInteger(8), 2))).toBe("0.13");
    expect(formatDecimal(divide(parseDecimal("0.00000003"), fromInteger(3), 8))).toBe("0.00000001");
  });
});
