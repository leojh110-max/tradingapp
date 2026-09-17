import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle, Timeframe } from "../../types/market";
import { CHART_COLORS, toChartCandle, toChartVolume } from "../../utils/chartAdapter";
import { clampVisibleTimeRange, INITIAL_VISIBLE_BARS, TIMEFRAME_MS, type TimeRangeMs } from "../../utils/timeframes";

type Props = {
  candles: Candle[];
  interval: Timeframe;
  initialTimeRange: TimeRangeMs | null;
  onHover: (candle: Candle | null) => void;
  onNeedOlder: () => void;
  onVisibleTimeRangeChange: (range: TimeRangeMs | null) => void;
  loadingOlder: boolean;
};
const LEFT_EDGE_THRESHOLD = 40;

export function CandlestickChart({
  candles,
  interval,
  initialTimeRange,
  onHover,
  onNeedOlder,
  onVisibleTimeRangeChange,
  loadingOlder,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const onHoverRef = useRef(onHover);
  const onNeedOlderRef = useRef(onNeedOlder);
  const loadingOlderRef = useRef(loadingOlder);
  const initializedViewRef = useRef(false);
  const previousLengthRef = useRef(0);

  const onVisibleTimeRangeChangeRef = useRef(onVisibleTimeRangeChange);
  const restoreOnceRef = useRef(initialTimeRange);
  const intervalRef = useRef(interval);

  candlesRef.current = candles;
  onHoverRef.current = onHover;
  onNeedOlderRef.current = onNeedOlder;
  loadingOlderRef.current = loadingOlder;
  onVisibleTimeRangeChangeRef.current = onVisibleTimeRangeChange;
  intervalRef.current = interval;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#0b0f14" },
        textColor: "#9aa4b2",
        fontFamily: "Segoe UI, system-ui, -apple-system, sans-serif",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#1c2430" },
        horzLines: { color: "#1c2430" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#4b5568", style: 0, width: 1 },
        horzLine: { color: "#4b5568", style: 0, width: 1 },
      },
      rightPriceScale: {
        borderColor: "#243042",
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: {
        borderColor: "#243042",
        timeVisible: true,
        secondsVisible: interval === "1m",
        rightOffset: 6,
        barSpacing: 7,
        minBarSpacing: 0.4,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: CHART_COLORS.up,
      downColor: CHART_COLORS.down,
      borderVisible: false,
      wickUpColor: CHART_COLORS.up,
      wickDownColor: CHART_COLORS.down,
    });
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
      borderVisible: false,
    });

    chart.subscribeCrosshairMove((param) => {
      if (param.time === undefined) {
        const latest = candlesRef.current[candlesRef.current.length - 1] ?? null;
        onHoverRef.current(latest);
        return;
      }
      const hovered = findCandleByChartTime(candlesRef.current, param.time);
      onHoverRef.current(hovered ?? null);
    });

    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!range || loadingOlderRef.current) {
        return;
      }
      if (range.from < LEFT_EDGE_THRESHOLD) {
        onNeedOlderRef.current();
      }
    });
    chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
      if (!range || typeof range.from !== "number" || typeof range.to !== "number") {
        onVisibleTimeRangeChangeRef.current(null);
        return;
      }
      onVisibleTimeRangeChangeRef.current({
        from: range.from * 1000,
        to: range.to * 1000,
      });
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const chart = chartRef.current;
    if (!candleSeries || !volumeSeries || !chart) {
      return;
    }
    const candlePoints = candles.map((candle) => {
      const point = toChartCandle(candle);
      return {
        time: point.time as UTCTimestamp,
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
      };
    });
    const volumePoints = candles.map((candle) => {
      const point = toChartVolume(candle);
      return {
        time: point.time as UTCTimestamp,
        value: point.value,
        color: point.color,
      };
    });
    const previousLength = previousLengthRef.current;
    const logical = chart.timeScale().getVisibleLogicalRange();
    candleSeries.setData(candlePoints);
    volumeSeries.setData(volumePoints);

    if (!initializedViewRef.current && candles.length > 0) {
      const restored = clampVisibleTimeRange(
        restoreOnceRef.current,
        TIMEFRAME_MS[intervalRef.current],
        candles[0].openTime,
        candles[candles.length - 1].openTime,
      );
      if (restored) {
        chart.timeScale().setVisibleRange({
          from: (restored.from / 1000) as UTCTimestamp,
          to: (restored.to / 1000) as UTCTimestamp,
        });
      } else {
        const from = Math.max(0, candles.length - INITIAL_VISIBLE_BARS);
        chart.timeScale().setVisibleLogicalRange({
          from,
          to: candles.length - 1 + 4,
        });
      }
      initializedViewRef.current = true;
      const latest = candles[candles.length - 1];
      onHoverRef.current(latest);
    } else if (logical && candles.length > previousLength) {
      const added = candles.length - previousLength;
      chart.timeScale().setVisibleLogicalRange({
        from: logical.from + added,
        to: logical.to + added,
      });
    }
    previousLengthRef.current = candles.length;
  }, [candles]);

  return <div ref={containerRef} className="chart-canvas" role="img" aria-label={`BTC USDT ${interval} candlestick chart`} />;
}

function findCandleByChartTime(candles: Candle[], time: Time): Candle | undefined {
  if (typeof time !== "number") {
    return undefined;
  }
  const exact = candles.find((candle) => candle.openTime / 1000 === time);
  if (exact) {
    return exact;
  }
  const asMillis = Math.round(time * 1000);
  const rounded = candles.find((candle) => candle.openTime === asMillis);
  if (rounded) {
    return rounded;
  }
  let nearest: Candle | undefined;
  let nearestDiff = Number.POSITIVE_INFINITY;
  for (const candle of candles) {
    const diff = Math.abs(candle.openTime / 1000 - time);
    if (diff < nearestDiff) {
      nearestDiff = diff;
      nearest = candle;
    }
  }
  return nearestDiff < 1 ? nearest : undefined;
}
