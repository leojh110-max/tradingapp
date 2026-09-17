# Aggregation Policy (Phase 2-B)

This document is the source of truth for higher-timeframe candles.
It was written after inspecting the live Phase 1 Master Dataset (`market.db`),
not from a guessed formula.

Master `1m` rows are **never** updated, rounded, shifted, or invented.

## Source

- Exchange / market / symbol / interval in DB: `BINANCE` / `SPOT` / `BTCUSDT` / `1m`
- Higher timeframes are computed in memory from a **bounded 1m range query**
- Aggregated candles are **not** written back to `market.db`

## UTC calendar buckets

For a higher timeframe with duration `I` milliseconds, a source `1m` candle
with timestamp `open_time` (unix ms, unmodified) is **assigned** to:

```
bucket_start = (open_time // I) * I
```

This is grouping only. The original `1m` `open_time` stays in the Master Dataset.

Unix epoch is UTC, so these bucket starts are UTC calendar boundaries:

| Interval | Bucket starts (UTC) |
| --- | --- |
| 5m | `:00`, `:05`, `:10`, `:15`, `:20`, `:25`, `:30`, `:35`, `:40`, `:45`, `:50`, `:55` |
| 10m | `:00`, `:10`, `:20`, `:30`, `:40`, `:50` |
| 15m | `:00`, `:15`, `:30`, `:45` |
| 30m | `:00`, `:30` |
| 1h | `HH:00` |
| 4h | `00:00`, `04:00`, `08:00`, `12:00`, `16:00`, `20:00` |
| 1d | `00:00` UTC |

A `1m` candle belongs to bucket `B` when `B <= open_time < B + I`.

The aggregated candle identity (`openTime` in the API) is `B`, not the first
source timestamp (which may be offset, e.g. `B + 20799`).

## OHLCV

Over the actual source candles in the bucket, in time order:

- Open = first source `open` (original TEXT)
- High = source `high` with maximum `Decimal(high)` (original TEXT token)
- Low = source `low` with minimum `Decimal(low)` (original TEXT token)
- Close = last source `close` (original TEXT)
- Volume = `Decimal` sum of source `volume` values, serialized with `format(d, "f")`

No binary float arithmetic.

## Completeness metadata

- `expectedCandleCount` = `I / 60_000` (calendar 1-minute slots in the bucket)
- `sourceCandleCount` = number of **actual** 1m rows in the bucket
- `complete` = `sourceCandleCount == expectedCandleCount`

Empty buckets are **not** emitted. Missing 1m candles are **not** synthesized.

`complete` is false when there are gaps, a replay cutoff, a series start/end
partial bucket, or extra overlapping source rows at an alignment transition.

## Observed Master Dataset regimes

### A. Normal UTC-aligned

Most of the series: `open_time % 60000 == 0`, 60s spacing.

Example: `2017-08-17 04:00:00.000` (`1502942400000`) through typical recent data.

A normal 5m bucket contains five 1m rows and is `complete`.

### B. Offset 20799 ms (valid Binance RAW)

- Count: 20,401
- First: `2017-12-04 06:00:20.799` (`1512367220799`)
- Last: `2017-12-18 10:00:20.799` (`1513591220799`)
- Spacing inside the regime: 60_000 ms

These timestamps are **not** errors. They are not normalized.

`1512367220799` maps to UTC buckets (grouping only):

| TF | bucket_start |
| --- | --- |
| 5m | `2017-12-04 06:00:00.000` (`1512367200000`) |
| 1h | `2017-12-04 06:00:00.000` (`1512367200000`) |
| 4h | `2017-12-04 04:00:00.000` (`1512360000000`) |
| 1d | `2017-12-04 00:00:00.000` (`1512345600000`) |

### C. Offset 14789 ms (valid Binance RAW)

- Count: 1,201
- First: `2018-02-09 09:59:14.789` (`1518170354789`)
- Last: `2018-02-10 05:59:14.789` (`1518242354789`)
- Spacing inside the regime: 60_000 ms

`1518170354789` maps to:

| TF | bucket_start |
| --- | --- |
| 5m | `2018-02-09 09:55:00.000` (`1518170100000`) |
| 1h | `2018-02-09 09:00:00.000` (`1518166800000`) |
| 1d | `2018-02-09 00:00:00.000` (`1518134400000`) |

### D. Alignment transitions (not a continuous 1m sequence)

1. **Aligned → 20799** (same UTC minute contains two real candles):
   - `2017-12-04 06:00:00.000` offset 0
   - `2017-12-04 06:00:20.799` offset 20799
   - delta = 20_799 ms
   - The 5m bucket `06:00` therefore has **6** actual 1m rows (`complete = false`)
   - Both rows are used. Neither is dropped or rewritten.

2. **20799 → aligned** with a RAW gap:
   - last offset `2017-12-18 10:00:20.799`
   - next aligned `2017-12-18 10:14:00.000`
   - delta = 819_201 ms
   - Intermediate 5m buckets with no source rows are not emitted

3. **Aligned → 14789** with a large RAW gap:
   - last aligned `2018-02-08 00:28:00.000`
   - first offset `2018-02-09 09:59:14.789`
   - delta = 120_674_789 ms (~33.5 h)
   - Not treated as consecutive 1m candles

4. **14789 → aligned** with a RAW gap:
   - last offset `2018-02-10 05:59:14.789`
   - next aligned `2018-02-10 06:15:00.000`
   - delta = 945_211 ms

### E. RAW source gap example

`2018-06-26 02:00` through `11:59` UTC: no 1m rows.

- Last present: `2018-06-26 01:59:00.000`
- First present after gap: `2018-06-26 12:00:00.000`
- 1h buckets `02:00`–`11:00` are absent (not fabricated)

## Query range expansion

A requested window is expanded to **full UTC buckets** before reading 1m data
so a partial query cannot invent a partial higher-timeframe candle.

Example: request `10:03`–`11:02` at 5m → source `10:00`–`11:04:59.999`.

`limit` counts **output** higher-timeframe candles, not source 1m rows.
The 1m query is bounded to about `limit` calendar buckets (plus bucket edges),
never the full 4.7M series.

## Replay cutoff

`cutoff` is applied to **source 1m** rows (`open_time <= cutoff`) before
aggregation. Later 1m candles are not read.

If cutoff falls inside a bucket, that higher-timeframe candle is returned
`complete = false` using only allowed source rows (no look-ahead).

## Derived cache

Phase 2-C may materialize the same UTC-bucket candles in
`data/cache/aggregate_cache.db`. That file is not a source of truth. Cache
generation must use this policy's aggregation core. See `docs/CACHE.md`.
