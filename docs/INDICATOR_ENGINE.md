# Indicator Engine (Phase 2-E / 2-F / 2-G)

SMA, EMA, RSI, and MACD are derived overlay/pane indicators on top of the existing candle API.
Indicators are **derived**. They are not stored in `market.db` or `aggregate_cache.db`.

## Architecture

```text
Displayed candles + warmup candles (API)
        ↓
source resolver (open/high/low/close)
        ↓
registry calculator (SMA / EMA / RSI / MACD)
        ↓
IndicatorOutput (per instance, named series[])
        ↓
TradingChart overlay LineSeries and native pane LineSeries / HistogramSeries
```

UI (`IndicatorsPanel`, legend) never contains formulas.

## Models

- **IndicatorDefinition** — type metadata (id, name, placement, sources, defaults, warmup, calculator)
- **IndicatorInstance** — unique `id` plus settings (period, source, color, lineWidth, visible; RSI levels; MACD fast/slow/signal and per-series colors)
- **IndicatorOutput** — `{ instanceId, series: [{ key, title, points, renderType, valueKind }] }`

One instance may emit multiple named series (MACD → `macd`, `signal`, `histogram`). SMA/EMA/RSI still emit a single `value` series. This is the general multi-output model; Bollinger/Stochastic/Ichimoku can register additional keys later without a new result shape.

Placement is `overlay` | `pane`. Overlay SMA/EMA render on the main price scale. Pane types (`rsi`, `macd`) use Lightweight Charts `addPane()` grouped by `paneGroup` and ordered by `paneOrder`. See `docs/INDICATOR_PANES.md`.

## SMA

For period `N` and source series `x`:

```text
SMA_t = (x_t + x_(t-1) + … + x_(t-N+1)) / N
```

Implemented with a rolling BigInt sum (`O(n)`). No value is emitted until `N` actual samples exist. Missing UTC buckets are **not** filled.

## EMA

```text
alpha = 2 / (N + 1)
seed  = SMA of the first N actual samples
EMA_t = alpha * x_t + (1 - alpha) * EMA_(t-1)
      = (2 * x_t + (N - 1) * EMA_(t-1)) / (N + 1)
```

No value is emitted for the first `N-1` samples. The seed is the SMA of the first `N` samples (standard seed policy for this app).

## Precision

SMA and EMA use the existing BigInt decimal helper (`utils/decimal.ts`).

- Source strings are parsed exactly.
- SMA division uses half-up rounding at the source scale.
- EMA recurrence uses a working scale of **source scale + 12** guard digits, then formats by trimming trailing zeros.

JavaScript `Number` is used only when plotting in Lightweight Charts.

## Warm-up

Displayed candles alone are not enough (e.g. EMA 200 with 180 visible bars).

Warm-up candles are fetched with the existing API:

```text
GET /api/candles?to=<firstDisplayed.openTime - 1>&limit=<prior>
```

That returns the last `prior` **actual** candles before the visible window. No synthetic timestamps.

Warm-up rows are calculation input only. They are not merged into the chart series unless the user already lazy-loaded them.

### SMA warm-up

`prior = N - 1` actual candles before the first displayed bar.

### EMA warm-up

EMA is recursive. A seed taken at the visible start would not match an EMA computed from earlier history.

Let `α = 2/(N+1)` and `δ = 1-α = (N-1)/(N+1)`. After `k` updates the seed weight is `δ^k`.

We require `δ^k ≤ 1e-8`:

```text
k = ceil( ln(1e-8) / ln((N-1)/(N+1)) )     (N > 1)
k = 0                                       (N = 1)
```

For large `N`, `k ≈ 9.21 × (N+1)`.

Prior candles before the first **displayed** output:

```text
prior = N - 1 + k
```

so the seed is formed `k` steps before the first visible bar. Residual seed influence on the first visible EMA is then `≤ 1e-8` (relative to a unit seed). On BTC prices (~1e5) that is far below display precision.

If the series start has fewer candles than `prior`, calculation starts at the first actual candle (same seed rule). Values before `N` samples remain absent.

This is **deterministic**: the same `(market, interval, timestamp, settings, available actual history)` yields the same EMA. Adding history **beyond** `prior` before a timestamp `T` changes EMA(`T`) by at most ~`1e-8` relative. Tests use relative tolerance `1e-6` / 12 guard digits compared as decimals.

## Gap policy

SMA/EMA walk the **chronological sequence of real candles**. Empty UTC slots are skipped (never filled with 0 or previous close). A gap does **not** reset the moving average; the next real sample continues the window/recurrence.

## Timestamp policy

- `1m` output `openTime` is the source candle `openTime` (including 20799 ms / 14789 ms offsets). Never floored to a minute.
- HTF output `openTime` is the API bucket identity.

## Replay cutoff

When `cutoff` is set, only candles with `openTime <= cutoff` are inputs. No output may have `openTime > cutoff`. The engine consumes the same HTF partial-bucket API result as the chart (Phase 2-C). It must not fetch a later complete cached bucket.

## Persistence

`localStorage` key `chart.indicators.v1`. Cloud sync is forbidden. Invalid payloads fall back to `[]`.

## Warm-up fetch

Uses existing `GET /api/candles?to=<firstDisplayed.openTime-1>&limit=<prior>`.

API `limit` max is 5000, so EMA 5000 (`prior ≈ 51051`) pages backward in 5000-candle chunks. Warm-up rows are never merged into the displayed chart series.

Color / line width / visibility / MACD series colors do not refetch or recompute.

## Pane architecture

`placement` is `overlay | pane`. Overlay SMA/EMA render on the main price scale. Pane indicators use Lightweight Charts `addPane()` grouped by `paneGroup` and sorted by `paneOrder` (RSI = 10, MACD = 20 → Main, RSI, MACD). Multiple instances of the same type share one pane. See `docs/INDICATOR_PANES.md`.

`valueKind` (`price` | `oscillator` | `percentage` | `priceDelta` | `generic`) is a display hint only. Engine output strings stay full precision; legends call `formatIndicatorValue`.

`renderType` (`line` | `histogram`) is per series, not per indicator type.

## RSI (Wilder)

```text
change_t = x_t - x_(t-1)
gain_t = max(change_t, 0)
loss_t = max(-change_t, 0)
seed avgGain/avgLoss = mean of the first N gains/losses
avgGain_t = ((avgGain_(t-1) * (N-1)) + gain_t) / N
avgLoss_t = ((avgLoss_(t-1) * (N-1)) + loss_t) / N
RSI = 100 * avgGain / (avgGain + avgLoss)
```

First output is at the `(N+1)`th actual sample. Edges:

- avgLoss = 0 and avgGain > 0 → **100**
- avgGain = 0 and avgLoss > 0 → **0**
- both 0 → **50**

### RSI warm-up

Wilder decay `δ = (N-1)/N`. Same `ε = 1e-8` as EMA:

```text
k = ceil( ln(1e-8) / ln((N-1)/N) )     (N > 1)
prior = N + k
```

RSI 14: `k = 249`, **prior = 263**. RSI 200: prior = 3875.

## MACD

Defaults: Fast = 12, Slow = 26, Signal = 9, source = Close.

```text
FastEMA_t = EMA(source, fast)     // same EMA policy as overlay EMA
SlowEMA_t = EMA(source, slow)
MACD_t    = FastEMA_t - SlowEMA_t
Signal_t  = EMA(MACD, signal)     // EMA of the MACD output sequence
Histogram_t = MACD_t - Signal_t
```

Fast/Slow/Signal all use the overlay EMA primitive (`calculateEmaValues`): SMA seed of the first N actual samples, then `α = 2/(N+1)`. No separate MACD EMA.

MACD exists from the first timestamp where both Fast and Slow EMAs exist (the Slow seed). Signal is omitted until `signalPeriod` valid MACD values exist; its seed is the SMA of those first Signal-length MACD values, then the same EMA recurrence. Histogram exists only where Signal exists. Leading zeros are never fabricated.

`valueKind` is `priceDelta` (price difference, not a 0–100 oscillator). The MACD pane autoscales from the current series range and always includes 0 so the zero line stays meaningful. It does not share the main price scale or the RSI scale.

### MACD warm-up

Slow EMA seed error and Signal EMA seed error both matter. Fast EMA converges faster than Slow (`fast < slow`), so Slow dominates the source EMA bound.

Using the same `ε = 10^-8` extra-step count as overlay EMA:

```text
k(N) = ceil( ln(1e-8) / ln((N-1)/(N+1)) )     (N > 1)
emaPrior(N) = N - 1 + k(N)

prior = max(emaPrior(fast), emaPrior(slow)) + emaPrior(signal)
```

This is an upper bound: Slow EMA is given its full `k(slow)` extra samples, then Signal is given a full `emaPrior(signal)` of already-converging MACD values. It is not a magic `slowPeriod * 10`.

MACD 12/26/9: `k(26)=240`, `emaPrior(26)=265`, `k(9)=83`, `emaPrior(9)=91`, **prior = 356**.

MACD 5/35/5: `emaPrior(35)=357`, `emaPrior(5)=50`, **prior = 407**.

If fewer actual candles exist than `prior`, calculation starts at the first real sample. Values still appear only after the EMA/Signal seeds are legally formed.

### MACD gap / timestamp / cutoff

Same as SMA/EMA/RSI: chronological actual samples only; no synthetic UTC buckets; no reset after a gap; 1m `openTime` offsets preserved; HTF uses API bucket `openTime`; `openTime <= cutoff` only.

Multiple MACD instances are allowed and share `paneGroup: "macd"`. Hide/remove of one instance does not affect the other. The pane is removed when the last visible MACD instance is hidden or removed.

## Display precision

SMA/EMA legend values are formatted at 2 decimal places. RSI (`oscillator`) at 2 decimals. MACD (`priceDelta`) at 2 decimals. Internal BigInt strings are not truncated.

## Limits

- Period: integer `1…5000`
- Line width: integer `1…4`
- Active instances: `20`
- Same type+period may be added more than once (distinct instance ids)
- No Web Worker in this phase (SMA/EMA on 10k samples is main-thread)
- No indicator DB cache
