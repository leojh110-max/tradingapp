"""Independent MACD reference using Python Decimal.

Mirrors the app EMA policy (SMA seed of first N, then alpha = 2/(N+1))
with half-up rounding at source_scale + 12. Not imported by the frontend.
"""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

GUARD = 12


def parse(raw: str) -> Decimal:
    return Decimal(raw)


def scale_of(value: Decimal) -> int:
    exp = value.as_tuple().exponent
    return -exp if exp < 0 else 0


def div(left: Decimal, right: Decimal, result_scale: int) -> Decimal:
    quant = Decimal(10) ** -result_scale
    return (left / right).quantize(quant, rounding=ROUND_HALF_UP)


def format_decimal(value: Decimal) -> str:
    text = format(value, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    if text in {"", "-0"}:
        return "0"
    return text


def ema(values: list[Decimal], period: int) -> list[Decimal]:
    if period < 1:
        raise ValueError("period must be >= 1")
    if len(values) < period:
        return []
    work_scale = max(scale_of(value) for value in values) + GUARD
    seed = div(sum(values[:period], Decimal(0)), Decimal(period), work_scale)
    points = [seed]
    two = Decimal(2)
    period_minus = Decimal(period - 1)
    period_plus = Decimal(period + 1)
    previous = seed
    for value in values[period:]:
        previous = div(two * value + period_minus * previous, period_plus, work_scale)
        points.append(previous)
    return points


def macd(
    values: list[Decimal],
    fast_period: int,
    slow_period: int,
    signal_period: int,
) -> tuple[list[Decimal], list[Decimal], list[Decimal]]:
    if fast_period >= slow_period:
        raise ValueError("Fast length must be smaller than slow length.")
    fast = ema(values, fast_period)
    slow = ema(values, slow_period)
    # Align on the slow start: both series exist from index slow-1.
    offset = slow_period - fast_period
    macd_line = [fast[index + offset] - slow[index] for index in range(len(slow))]
    signal_input = [parse(format_decimal(value)) for value in macd_line]
    signal = ema(signal_input, signal_period)
    histogram = [macd_line[index + signal_period - 1] - signal[index] for index in range(len(signal))]
    return macd_line, signal, histogram


def dump(label: str, prices: list[str], fast: int, slow: int, signal: int) -> None:
    values = [parse(price) for price in prices]
    macd_line, signal_line, histogram = macd(values, fast, slow, signal)
    print(f"== {label} fast={fast} slow={slow} signal={signal} n={len(prices)}")
    print("macd", [format_decimal(value) for value in macd_line[:8]], "count", len(macd_line))
    print("signal", [format_decimal(value) for value in signal_line[:8]], "count", len(signal_line))
    print("hist", [format_decimal(value) for value in histogram[:8]], "count", len(histogram))
    if macd_line:
        print("first_macd", format_decimal(macd_line[0]))
    if signal_line:
        print("first_signal", format_decimal(signal_line[0]))
        print("second_signal", format_decimal(signal_line[1]) if len(signal_line) > 1 else None)
        print("first_hist", format_decimal(histogram[0]))
    if len(macd_line) > 20:
        print("macd[20]", format_decimal(macd_line[20]))
        print("signal[20-slow?]")
        signal_index = 20 - (signal - 1)
        if 0 <= signal_index < len(signal_line):
            print("signal_at_macd20", format_decimal(signal_line[signal_index]))
            print("hist_at_macd20", format_decimal(histogram[signal_index]))


if __name__ == "__main__":
    dump("hand_2_3_2", [str(n) for n in range(1, 8)], 2, 3, 2)
    dump(
        "irregular",
        ["10", "12", "11", "15", "14", "18", "16", "20", "19", "22", "21", "25"],
        2,
        4,
        2,
    )
    dump("constant", ["100"] * 40, 12, 26, 9)
    dump("trend_1_80", [str(n) for n in range(1, 81)], 12, 26, 9)
    dump(
        "btc_like",
        ["71245.20", "71300.10", "71410.00", "71350.50", "71500.25"] + [str(71500 + i * 12.5) for i in range(40)],
        12,
        26,
        9,
    )
