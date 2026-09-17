/** Scale-aware decimal arithmetic for API OHLCV strings. Avoids binary float. */

export type DecimalValue = {
  sign: 1 | -1;
  coeff: bigint;
  scale: number;
};

const ZERO: DecimalValue = { sign: 1, coeff: 0n, scale: 0 };

export function parseDecimal(raw: string): DecimalValue {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed === ".") {
    throw new Error(`Invalid decimal: ${raw}`);
  }
  let sign: 1 | -1 = 1;
  let body = trimmed;
  if (body.startsWith("-")) {
    sign = -1;
    body = body.slice(1);
  } else if (body.startsWith("+")) {
    body = body.slice(1);
  }
  if (!/^\d+(\.\d+)?$/u.test(body)) {
    throw new Error(`Invalid decimal: ${raw}`);
  }
  const dot = body.indexOf(".");
  const digits = dot === -1 ? body : body.slice(0, dot) + body.slice(dot + 1);
  const scale = dot === -1 ? 0 : body.length - dot - 1;
  const coeff = BigInt(digits === "" ? "0" : digits);
  if (coeff === 0n) {
    return { sign: 1, coeff: 0n, scale };
  }
  return { sign, coeff, scale };
}

export function isZero(value: DecimalValue): boolean {
  return value.coeff === 0n;
}

export function compare(left: DecimalValue, right: DecimalValue): number {
  const scale = Math.max(left.scale, right.scale);
  const a = toSignedCoeff(left, scale);
  const b = toSignedCoeff(right, scale);
  if (a === b) {
    return 0;
  }
  return a > b ? 1 : -1;
}

export function add(left: DecimalValue, right: DecimalValue): DecimalValue {
  const scale = Math.max(left.scale, right.scale);
  return fromSignedCoeff(toSignedCoeff(left, scale) + toSignedCoeff(right, scale), scale);
}

export function subtract(left: DecimalValue, right: DecimalValue): DecimalValue {
  const scale = Math.max(left.scale, right.scale);
  return fromSignedCoeff(toSignedCoeff(left, scale) - toSignedCoeff(right, scale), scale);
}

export function abs(value: DecimalValue): DecimalValue {
  return { sign: 1, coeff: value.coeff, scale: value.scale };
}

export function max(left: DecimalValue, right: DecimalValue): DecimalValue {
  return compare(left, right) >= 0 ? left : right;
}

export function min(left: DecimalValue, right: DecimalValue): DecimalValue {
  return compare(left, right) <= 0 ? left : right;
}

export function formatDecimal(value: DecimalValue): string {
  const digits = value.coeff.toString().padStart(value.scale + 1, "0");
  let rendered: string;
  if (value.scale === 0) {
    rendered = digits;
  } else {
    const split = digits.length - value.scale;
    rendered = `${digits.slice(0, split)}.${digits.slice(split)}`;
  }
  const trimmed = rendered.includes(".")
    ? rendered.replace(/(\.\d*?[1-9])0+$/u, "$1").replace(/\.0+$/u, "")
    : rendered;
  if (trimmed === "0" || trimmed === "") {
    return "0";
  }
  return value.sign === -1 ? `-${trimmed}` : trimmed;
}

export function formatSignedDecimal(value: DecimalValue): string {
  const rendered = formatDecimal(value);
  if (rendered === "0") {
    return "0";
  }
  if (rendered.startsWith("-")) {
    return rendered;
  }
  return `+${rendered}`;
}

export function fromInteger(value: number): DecimalValue {
  if (!Number.isInteger(value)) {
    throw new Error("fromInteger requires an integer");
  }
  if (value === 0) {
    return { sign: 1, coeff: 0n, scale: 0 };
  }
  if (value < 0) {
    return { sign: -1, coeff: BigInt(-value), scale: 0 };
  }
  return { sign: 1, coeff: BigInt(value), scale: 0 };
}

export function multiply(left: DecimalValue, right: DecimalValue): DecimalValue {
  if (left.coeff === 0n || right.coeff === 0n) {
    return { sign: 1, coeff: 0n, scale: left.scale + right.scale };
  }
  return {
    sign: left.sign === right.sign ? 1 : -1,
    coeff: left.coeff * right.coeff,
    scale: left.scale + right.scale,
  };
}

export function divide(left: DecimalValue, right: DecimalValue, resultScale: number): DecimalValue {
  if (isZero(right)) {
    throw new Error("division by zero");
  }
  if (resultScale < 0) {
    throw new Error("resultScale must be >= 0");
  }
  const num = toSignedCoeff(left, left.scale);
  const den = toSignedCoeff(right, right.scale);
  const negative = num < 0n !== den < 0n;
  const absNum = num < 0n ? -num : num;
  const absDen = den < 0n ? -den : den;
  const exp = right.scale - left.scale + resultScale;
  let quotient: bigint;
  if (exp >= 0) {
    const scaled = absNum * pow10(exp);
    quotient = (scaled + absDen / 2n) / absDen;
  } else {
    const divisor = absDen * pow10(-exp);
    quotient = (absNum + divisor / 2n) / divisor;
  }
  return fromSignedCoeff(negative ? -quotient : quotient, resultScale);
}

export function percentOf(numerator: DecimalValue, denominator: DecimalValue, places = 4): string | null {
  if (isZero(denominator)) {
    return null;
  }
  const scale = Math.max(numerator.scale, denominator.scale);
  const num = toSignedCoeff(numerator, scale);
  const den = toSignedCoeff(denominator, scale);
  const negative = num < 0n !== den < 0n;
  const absNum = num < 0n ? -num : num;
  const absDen = den < 0n ? -den : den;
  const scaled = absNum * 100n * pow10(places);
  const rounded = (scaled + absDen / 2n) / absDen;
  const asDecimal = fromSignedCoeff(negative ? -rounded : rounded, places);
  return formatDecimal(asDecimal);
}

function toSignedCoeff(value: DecimalValue, targetScale: number): bigint {
  const coeff = value.coeff * pow10(targetScale - value.scale);
  return value.sign === -1 ? -coeff : coeff;
}

function fromSignedCoeff(value: bigint, scale: number): DecimalValue {
  if (value === 0n) {
    return { ...ZERO, scale };
  }
  if (value < 0n) {
    return { sign: -1, coeff: -value, scale };
  }
  return { sign: 1, coeff: value, scale };
}

function pow10(power: number): bigint {
  if (power < 0) {
    throw new Error("negative power");
  }
  return 10n ** BigInt(power);
}
