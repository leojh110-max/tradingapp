# Indicator Panes (Phase 2-F / 2-G)

Native Lightweight Charts 5.2.1 panes host oscillator indicators. Volume stays on the **main pane** as a separate price scale (unchanged). Pane indicators use `chart.addPane()`.

## Architecture

```text
IndicatorDefinition.paneGroup + paneOrder
        ↓
visible pane groups (sorted, not object-iteration order)
        ↓
IPaneApi (one pane per group)
        ↓
per-series LineSeries or HistogramSeries + reference price lines
```

- **SMA/EMA** — `placement: overlay`, `paneGroup: null`, main price scale
- **RSI** — `placement: pane`, `paneGroup: "rsi"`, `paneOrder: 10`, fixed 0–100 scale
- **MACD** — `placement: pane`, `paneGroup: "macd"`, `paneOrder: 20`, independent autoscale including 0

RSI and MACD never share a pane. Multiple RSI instances share `rsi`. Multiple MACD instances share `macd`.

## Multi-output series

Each `IndicatorOutput.series[]` entry carries `renderType` and `valueKind`:

- MACD line — `renderType: line`
- Signal line — `renderType: line`
- Histogram — `renderType: histogram` (local `HistogramSeries`)

Histogram bar color is derived from the calculated value (`>0` positive, `<0` negative, `==0` neutral). Color mapping is separate from the calculator.

## Pane order

`visiblePaneGroups` sorts by `paneOrder`, then by name. Current order:

1. Main price
2. RSI
3. MACD

Adding RSI after MACD rebuilds native panes into that order. React object key order is not used.

## Stretch / layout

Stretch is **pane-count** based, not `if (rsi)` / `if (macd)` CSS heights:

- 0 panes → main = 1
- 1 pane → main = 0.78, pane = 0.22
- 2 panes → main = 0.62, each pane = 0.19

Native `layout.panes.enableResize` stays **on**. Users can drag separators. Stretch is not persisted.

## Lifecycle

- No pane indicators → main only
- RSI only → Main + RSI
- MACD only → Main + MACD
- RSI + MACD → Main + RSI + MACD
- Hide last visible instance in a group → that pane is removed
- Chart type switch does not recreate panes or refetch indicator candles

## Crosshair / time

One chart instance. One time scale. Crosshair `param.time` updates OHLC, overlay legends, RSI legend, and MACD legend at the same timestamp. Missing outputs render as `—`, never the nearest neighbor.

## Zero / reference lines

- RSI: overbought / oversold (strong) and 50 (mid)
- MACD: 0 (mid, dotted, quieter than MACD/Signal/Histogram). No BUY/SELL labels.

## Display precision

Engine strings are not rounded. UI uses `formatIndicatorValue`:

- overlay `valueKind: price` → 2 decimals
- RSI `valueKind: oscillator` → 2 decimals
- MACD `valueKind: priceDelta` → 2 decimals
