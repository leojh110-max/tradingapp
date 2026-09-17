import { useEffect, useRef } from "react";
import {
  AreaSeries,
  BarSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  PriceScaleMode,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPaneApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesType,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { ViewIntent } from "../../types/chart";
import type { Candle, Timeframe } from "../../types/market";
import { histogramBarColor } from "../../indicators/histogram";
import type { IndicatorOverlayLine, IndicatorPaneLine, IndicatorRenderType } from "../../indicators/types";
import { mainStretchFactor, orderedPaneGroups, paneStretchFactor, uniqueLevels } from "../../indicators/panes";
import { hexToRgba, toChartCandle, toChartLinePoint, toChartVolume } from "../../utils/chartAdapter";
import type { ChartSettings, ChartType } from "../../utils/chartSettings";
import { clampVisibleTimeRange, INITIAL_VISIBLE_BARS, TIMEFRAME_MS, type TimeRangeMs } from "../../utils/timeframes";

type Props = {
  candles: Candle[];
  interval: Timeframe;
  initialTimeRange: TimeRangeMs | null;
  viewIntent: ViewIntent | null;
  settings: ChartSettings;
  selectedOpenTime: number | null;
  autoScaleToken: number;
  overlayLines: IndicatorOverlayLine[];
  paneLines: IndicatorPaneLine[];
  onPaneHostChange?: (group: string, host: HTMLElement | null) => void;
  onHover: (candle: Candle | null) => void;
  onSelect: (candle: Candle) => void;
  onNeedOlder: () => void;
  onVisibleTimeRangeChange: (range: TimeRangeMs | null) => void;
  loadingOlder: boolean;
};

type PaneSeriesApi = ISeriesApi<"Line"> | ISeriesApi<"Histogram">;

type PaneSeriesEntry = {
  api: PaneSeriesApi;
  renderType: IndicatorRenderType;
};

type PaneRecord = {
  pane: IPaneApi<Time>;
  series: Map<string, PaneSeriesEntry>;
  priceLines: IPriceLine[];
  priceLineSeries: PaneSeriesApi | null;
};

const LEFT_EDGE_THRESHOLD = 40;

export function TradingChart({
  candles,
  interval,
  initialTimeRange,
  viewIntent,
  settings,
  selectedOpenTime,
  autoScaleToken,
  overlayLines,
  paneLines,
  onPaneHostChange,
  onHover,
  onSelect,
  onNeedOlder,
  onVisibleTimeRangeChange,
  loadingOlder,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const overlaySeriesRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const panesRef = useRef<Map<string, PaneRecord>>(new Map());
  const onPaneHostChangeRef = useRef(onPaneHostChange);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const onHoverRef = useRef(onHover);
  const onSelectRef = useRef(onSelect);
  const onNeedOlderRef = useRef(onNeedOlder);
  const loadingOlderRef = useRef(loadingOlder);
  const initializedViewRef = useRef(false);
  const previousLengthRef = useRef(0);
  const onVisibleTimeRangeChangeRef = useRef(onVisibleTimeRangeChange);
  const restoreOnceRef = useRef(initialTimeRange);
  const intervalRef = useRef(interval);
  const settingsRef = useRef(settings);
  const chartTypeRef = useRef<ChartType>(settings.chartType);
  const appliedIntentRef = useRef<number | null>(null);

  candlesRef.current = candles;
  onHoverRef.current = onHover;
  onSelectRef.current = onSelect;
  onNeedOlderRef.current = onNeedOlder;
  loadingOlderRef.current = loadingOlder;
  onVisibleTimeRangeChangeRef.current = onVisibleTimeRangeChange;
  onPaneHostChangeRef.current = onPaneHostChange;
  intervalRef.current = interval;
  settingsRef.current = settings;

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
        panes: {
          enableResize: true,
          separatorColor: "#243042",
          separatorHoverColor: "rgba(110, 168, 254, 0.18)",
        },
      },
      grid: {
        vertLines: { color: "#1c2430", visible: settingsRef.current.showGrid },
        horzLines: { color: "#1c2430", visible: settingsRef.current.showGrid },
      },
      crosshair: {
        mode: settingsRef.current.showCrosshair ? CrosshairMode.Normal : CrosshairMode.Hidden,
        vertLine: { color: "#4b5568", style: 0, width: 1 },
        horzLine: { color: "#4b5568", style: 0, width: 1 },
      },
      rightPriceScale: {
        borderColor: "#243042",
        scaleMargins: { top: 0.08, bottom: settingsRef.current.showVolume ? 0.22 : 0.08 },
        autoScale: settingsRef.current.autoScale,
        mode: settingsRef.current.logScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
      },
      timeScale: {
        borderColor: "#243042",
        timeVisible: true,
        secondsVisible: intervalRef.current === "1m",
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

    const mainSeries = addMainSeries(chart, settingsRef.current);
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      visible: settingsRef.current.showVolume,
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
    chart.subscribeClick((param) => {
      if (param.time === undefined) {
        return;
      }
      const selected = findCandleByChartTime(candlesRef.current, param.time);
      if (selected) {
        onSelectRef.current(selected);
      }
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
    mainSeriesRef.current = mainSeries;
    volumeSeriesRef.current = volumeSeries;
    markersRef.current = createSeriesMarkers(mainSeries, []);
    chartTypeRef.current = settingsRef.current.chartType;

    return () => {
      markersRef.current?.detach();
      for (const group of panesRef.current.keys()) {
        onPaneHostChangeRef.current?.(group, null);
      }
      overlaySeriesRef.current.clear();
      panesRef.current.clear();
      chart.remove();
      chartRef.current = null;
      mainSeriesRef.current = null;
      volumeSeriesRef.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }
    const existing = overlaySeriesRef.current;
    const nextIds = new Set(overlayLines.map((line) => line.id));
    for (const [id, series] of existing) {
      if (!nextIds.has(id)) {
        chart.removeSeries(series);
        existing.delete(id);
      }
    }
    for (const line of overlayLines) {
      let series = existing.get(line.id);
      const width = Math.min(4, Math.max(1, line.lineWidth)) as 1 | 2 | 3 | 4;
      if (!series) {
        series = chart.addSeries(LineSeries, {
          color: line.color,
          lineWidth: width,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
          visible: line.visible,
        });
        existing.set(line.id, series);
      } else {
        series.applyOptions({
          color: line.color,
          lineWidth: width,
          visible: line.visible,
        });
      }
      series.setData(
        line.points
          .map((point) => toChartLinePoint(point.openTime, point.value))
          .filter((point) => Number.isFinite(point.value))
          .map((point) => ({
            time: point.time as UTCTimestamp,
            value: point.value,
          })),
      );
    }
  }, [overlayLines]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }
    const grouped = new Map<string, IndicatorPaneLine[]>();
    for (const line of paneLines) {
      const rows = grouped.get(line.paneGroup) ?? [];
      rows.push(line);
      grouped.set(line.paneGroup, rows);
    }
    const desired = orderedPaneGroups(grouped.keys());
    const currentOrder = [...panesRef.current.keys()];
    const orderOk =
      currentOrder.length === desired.length && currentOrder.every((group, index) => group === desired[index]);
    if (!orderOk) {
      for (const [group, record] of [...panesRef.current.entries()]) {
        for (const entry of record.series.values()) {
          chart.removeSeries(entry.api);
        }
        chart.removePane(record.pane.paneIndex());
        panesRef.current.delete(group);
        onPaneHostChangeRef.current?.(group, null);
      }
    }
    const stretch = paneStretchFactor(desired.length);
    chart.panes()[0]?.setStretchFactor(mainStretchFactor(desired));
    for (const group of desired) {
      const lines = grouped.get(group) ?? [];
      let record = panesRef.current.get(group);
      if (!record) {
        const pane = chart.addPane(true);
        pane.setStretchFactor(stretch);
        pane.priceScale("right").applyOptions({
          mode: PriceScaleMode.Normal,
          borderColor: "#243042",
          scaleMargins: { top: 0.08, bottom: 0.08 },
        });
        record = { pane, series: new Map(), priceLines: [], priceLineSeries: null };
        panesRef.current.set(group, record);
        const host = pane.getHTMLElement();
        if (host) {
          host.style.position = "relative";
          onPaneHostChangeRef.current?.(group, host);
        }
      } else {
        record.pane.setStretchFactor(stretch);
        record.pane.priceScale("right").applyOptions({ mode: PriceScaleMode.Normal });
      }
      const nextIds = new Set(lines.map((line) => line.id));
      for (const [id, entry] of [...record.series.entries()]) {
        if (!nextIds.has(id)) {
          chart.removeSeries(entry.api);
          record.series.delete(id);
        }
      }
      for (const line of lines) {
        let entry = record.series.get(line.id);
        if (entry && entry.renderType !== line.renderType) {
          chart.removeSeries(entry.api);
          record.series.delete(line.id);
          entry = undefined;
        }
        const width = Math.min(4, Math.max(1, line.lineWidth)) as 1 | 2 | 3 | 4;
        const scaleOptions =
          line.scaleMin != null && line.scaleMax != null
            ? {
                autoscaleInfoProvider: () => ({
                  priceRange: { minValue: line.scaleMin as number, maxValue: line.scaleMax as number },
                }),
              }
            : {};
        if (line.renderType === "histogram") {
          const options = {
            color: line.color,
            lastValueVisible: false,
            priceLineVisible: false,
            visible: line.visible,
            priceFormat: { type: "price" as const, precision: 2, minMove: 0.01 },
            ...scaleOptions,
          };
          if (!entry) {
            entry = { api: record.pane.addSeries(HistogramSeries, options), renderType: "histogram" };
            record.series.set(line.id, entry);
          } else {
            entry.api.applyOptions(options);
          }
          entry.api.setData(
            line.points
              .map((point) => {
                const mapped = toChartLinePoint(point.openTime, point.value);
                return {
                  time: mapped.time as UTCTimestamp,
                  value: mapped.value,
                  color: histogramBarColor(point.value, {
                    positive: line.histogramPositiveColor ?? line.color,
                    negative: line.histogramNegativeColor ?? line.color,
                    zero: line.histogramZeroColor,
                  }),
                };
              })
              .filter((point) => Number.isFinite(point.value)),
          );
        } else {
          const options = {
            color: line.color,
            lineWidth: width,
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
            visible: line.visible,
            priceFormat: { type: "price" as const, precision: 2, minMove: 0.01 },
            ...scaleOptions,
          };
          if (!entry) {
            entry = { api: record.pane.addSeries(LineSeries, options), renderType: "line" };
            record.series.set(line.id, entry);
          } else {
            entry.api.applyOptions(options);
          }
          entry.api.setData(
            line.points
              .map((point) => toChartLinePoint(point.openTime, point.value))
              .filter((point) => Number.isFinite(point.value))
              .map((point) => ({
                time: point.time as UTCTimestamp,
                value: point.value,
              })),
          );
        }
      }
      const first = record.series.values().next().value?.api;
      if (record.priceLineSeries && record.priceLines.length > 0) {
        for (const priceLine of record.priceLines) {
          try {
            record.priceLineSeries.removePriceLine(priceLine);
          } catch {
            // Series may already have been removed with the pane.
          }
        }
      }
      record.priceLines = [];
      record.priceLineSeries = first ?? null;
      if (first) {
        for (const level of uniqueLevels(lines)) {
          record.priceLines.push(
            first.createPriceLine({
              price: level.price,
              color: level.emphasis === "mid" ? "#3a4658" : "#6b7280",
              lineWidth: 1,
              lineStyle: level.emphasis === "mid" ? LineStyle.Dotted : LineStyle.Dashed,
              axisLabelVisible: level.emphasis === "strong",
              title: level.emphasis === "strong" ? level.label : "",
            }),
          );
        }
      }
    }
    if (desired.length === 0) {
      chart.panes()[0]?.setStretchFactor(1);
    }
  }, [paneLines]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }
    chart.applyOptions({
      grid: {
        vertLines: { color: "#1c2430", visible: settings.showGrid },
        horzLines: { color: "#1c2430", visible: settings.showGrid },
      },
      crosshair: {
        mode: settings.showCrosshair ? CrosshairMode.Normal : CrosshairMode.Hidden,
      },
      rightPriceScale: {
        scaleMargins: { top: 0.08, bottom: settings.showVolume ? 0.22 : 0.08 },
        autoScale: settings.autoScale,
        mode: settings.logScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
      },
      timeScale: {
        secondsVisible: interval === "1m",
      },
    });
    for (const record of panesRef.current.values()) {
      record.pane.priceScale("right").applyOptions({ mode: PriceScaleMode.Normal });
    }
  }, [settings.showGrid, settings.showCrosshair, settings.showVolume, settings.autoScale, settings.logScale, interval]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }
    if (chartTypeRef.current === settings.chartType && mainSeriesRef.current) {
      applySeriesColors(mainSeriesRef.current, settings);
      return;
    }
    const visible = chart.timeScale().getVisibleRange();
    markersRef.current?.detach();
    if (mainSeriesRef.current) {
      chart.removeSeries(mainSeriesRef.current);
    }
    const next = addMainSeries(chart, settings);
    mainSeriesRef.current = next;
    markersRef.current = createSeriesMarkers(next, []);
    chartTypeRef.current = settings.chartType;
    setMainSeriesData(next, settings.chartType, candlesRef.current);
    if (visible && typeof visible.from === "number" && typeof visible.to === "number") {
      chart.timeScale().setVisibleRange(visible);
    }
  }, [settings.chartType, settings.upColor, settings.downColor]);

  useEffect(() => {
    volumeSeriesRef.current?.applyOptions({ visible: settings.showVolume });
  }, [settings.showVolume]);

  useEffect(() => {
    const volumeSeries = volumeSeriesRef.current;
    if (!volumeSeries) {
      return;
    }
    volumeSeries.setData(
      candlesRef.current.map((candle) => {
        const point = toChartVolume(candle, { up: settings.upColor, down: settings.downColor });
        return {
          time: point.time as UTCTimestamp,
          value: point.value,
          color: point.color,
        };
      }),
    );
  }, [settings.upColor, settings.downColor]);

  useEffect(() => {
    const mainSeries = mainSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const chart = chartRef.current;
    if (!mainSeries || !volumeSeries || !chart) {
      return;
    }
    setMainSeriesData(mainSeries, chartTypeRef.current, candles);
    const volumePoints = candles.map((candle) => {
      const point = toChartVolume(candle, {
        up: settingsRef.current.upColor,
        down: settingsRef.current.downColor,
      });
      return {
        time: point.time as UTCTimestamp,
        value: point.value,
        color: point.color,
      };
    });
    volumeSeries.setData(volumePoints);
    const previousLength = previousLengthRef.current;
    const logical = chart.timeScale().getVisibleLogicalRange();
    if (!initializedViewRef.current && candles.length > 0) {
      applyInitialRange(chart, candles, restoreOnceRef.current, intervalRef.current);
      initializedViewRef.current = true;
      onHoverRef.current(candles[candles.length - 1]);
    } else if (
      logical &&
      candles.length > previousLength &&
      (viewIntent === null || appliedIntentRef.current === viewIntent.nonce)
    ) {
      const added = candles.length - previousLength;
      chart.timeScale().setVisibleLogicalRange({
        from: logical.from + added,
        to: logical.to + added,
      });
    }
    previousLengthRef.current = candles.length;
  }, [candles, viewIntent]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !viewIntent || candles.length === 0) {
      return;
    }
    if (appliedIntentRef.current === viewIntent.nonce) {
      return;
    }
    applyViewIntent(chart, candles, viewIntent, intervalRef.current);
    appliedIntentRef.current = viewIntent.nonce;
    initializedViewRef.current = true;
  }, [viewIntent, candles]);

  useEffect(() => {
    const markers = markersRef.current;
    if (!markers) {
      return;
    }
    if (selectedOpenTime === null) {
      markers.setMarkers([]);
      return;
    }
    markers.setMarkers([
      {
        time: (selectedOpenTime / 1000) as UTCTimestamp,
        position: "belowBar",
        color: "#6ea8fe",
        shape: "circle",
        size: 0.7,
      },
    ]);
  }, [selectedOpenTime, candles, settings.chartType]);

  useEffect(() => {
    if (autoScaleToken === 0) {
      return;
    }
    try {
      chartRef.current?.priceScale("right").applyOptions({ autoScale: true });
    } catch {
      // Keep the existing scale if the library rejects the mode.
    }
  }, [autoScaleToken]);

  return (
    <div
      ref={containerRef}
      className="chart-canvas"
      role="img"
      aria-label={`BTC USDT ${interval} ${settings.chartType} chart`}
    />
  );
}

function addMainSeries(chart: IChartApi, settings: ChartSettings): ISeriesApi<SeriesType> {
  const { chartType, upColor, downColor } = settings;
  if (chartType === "bar") {
    return chart.addSeries(BarSeries, { upColor, downColor });
  }
  if (chartType === "line") {
    return chart.addSeries(LineSeries, { color: upColor, lineWidth: 2 });
  }
  if (chartType === "area") {
    return chart.addSeries(AreaSeries, {
      lineColor: upColor,
      topColor: hexToRgba(upColor, 0.32),
      bottomColor: hexToRgba(upColor, 0.03),
      lineWidth: 2,
    });
  }
  return chart.addSeries(CandlestickSeries, {
    upColor,
    downColor,
    borderVisible: false,
    wickUpColor: upColor,
    wickDownColor: downColor,
  });
}

function applySeriesColors(series: ISeriesApi<SeriesType>, settings: ChartSettings): void {
  const { chartType, upColor, downColor } = settings;
  if (chartType === "line") {
    series.applyOptions({ color: upColor });
    return;
  }
  if (chartType === "area") {
    series.applyOptions({
      lineColor: upColor,
      topColor: hexToRgba(upColor, 0.32),
      bottomColor: hexToRgba(upColor, 0.03),
    });
    return;
  }
  if (chartType === "bar") {
    series.applyOptions({ upColor, downColor });
    return;
  }
  series.applyOptions({
    upColor,
    downColor,
    wickUpColor: upColor,
    wickDownColor: downColor,
  });
}

function setMainSeriesData(series: ISeriesApi<SeriesType>, chartType: ChartType, candles: Candle[]): void {
  if (chartType === "line" || chartType === "area") {
    series.setData(
      candles.map((candle) => ({
        time: (candle.openTime / 1000) as UTCTimestamp,
        value: Number(candle.close),
      })),
    );
    return;
  }
  series.setData(
    candles.map((candle) => {
      const point = toChartCandle(candle);
      return {
        time: point.time as UTCTimestamp,
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
      };
    }),
  );
}

function applyInitialRange(
  chart: IChartApi,
  candles: Candle[],
  requested: TimeRangeMs | null,
  interval: Timeframe,
): void {
  const restored = clampVisibleTimeRange(
    requested,
    TIMEFRAME_MS[interval],
    candles[0].openTime,
    candles[candles.length - 1].openTime,
  );
  if (restored) {
    chart.timeScale().setVisibleRange({
      from: (restored.from / 1000) as UTCTimestamp,
      to: (restored.to / 1000) as UTCTimestamp,
    });
    return;
  }
  applyLatestLogicalRange(chart, candles.length);
}

function applyViewIntent(chart: IChartApi, candles: Candle[], intent: ViewIntent, interval: Timeframe): void {
  try {
    chart.priceScale("right").applyOptions({ autoScale: true });
  } catch {
    // Logarithmic scale can reject empty/invalid ranges; keep the chart visible.
  }
  if (intent.kind === "reset" || intent.kind === "latest" || intent.centerMs === null) {
    applyLatestLogicalRange(chart, candles.length);
    return;
  }
  const restored = clampVisibleTimeRange(
    {
      from: intent.centerMs - INITIAL_VISIBLE_BARS * TIMEFRAME_MS[interval] * 0.5,
      to: intent.centerMs + INITIAL_VISIBLE_BARS * TIMEFRAME_MS[interval] * 0.5,
    },
    TIMEFRAME_MS[interval],
    candles[0].openTime,
    candles[candles.length - 1].openTime,
  );
  if (restored) {
    chart.timeScale().setVisibleRange({
      from: (restored.from / 1000) as UTCTimestamp,
      to: (restored.to / 1000) as UTCTimestamp,
    });
    return;
  }
  applyLatestLogicalRange(chart, candles.length);
}

function applyLatestLogicalRange(chart: IChartApi, length: number): void {
  const from = Math.max(0, length - INITIAL_VISIBLE_BARS);
  chart.timeScale().setVisibleLogicalRange({
    from,
    to: length - 1 + 4,
  });
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
