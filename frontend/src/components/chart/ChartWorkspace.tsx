import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useChartSettings } from "../../hooks/useChartSettings";
import { useFullscreen } from "../../hooks/useFullscreen";
import { useIndicators } from "../../hooks/useIndicators";
import { useMarketData } from "../../hooks/useMarketData";
import { useChartShortcuts } from "../../shortcuts/useChartShortcuts";
import type { Candle, Timeframe } from "../../types/market";
import { overlayChartLines, paneChartLines, visiblePaneGroups } from "../../indicators/panes";
import { getIndicatorDefinition } from "../../indicators/registry";
import { findNearestCandle } from "../../utils/candles";
import { CHART_LOAD_ERROR } from "../../utils/loadingOverlay";
import type { TimeRangeMs } from "../../utils/timeframes";
import { CandleInspector } from "./CandleInspector";
import { ChartErrorPanel } from "./ChartErrorPanel";
import { ChartInfoBar } from "./ChartInfoBar";
import { ChartSettingsPanel } from "./ChartSettingsPanel";
import { ChartStatusBar } from "./ChartStatusBar";
import { ChartToolbar } from "./ChartToolbar";
import { GoToDateDialog } from "./GoToDateDialog";
import { HistoricalLoadingIndicator } from "./HistoricalLoadingIndicator";
import { IndicatorLegend } from "./IndicatorLegend";
import { IndicatorsPanel } from "./IndicatorsPanel";
import { PrimaryLoadingOverlay } from "./PrimaryLoadingOverlay";
import { TradingChart } from "./TradingChart";

export function ChartWorkspace() {
  const {
    interval,
    pendingInterval,
    info,
    candles,
    status,
    error,
    retry,
    loadOlder,
    loadingOlder,
    olderError,
    hasOlder,
    changeTimeframe,
    restoreRange,
    showPrimaryOverlay,
    viewIntent,
    goToAnchor,
    goToLatest,
    requestResetView,
  } = useMarketData();
  const { settings, updateSettings } = useChartSettings();
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const { fullscreen, toggle: toggleFullscreen } = useFullscreen(workspaceRef);
  const [hovered, setHovered] = useState<Candle | null>(null);
  const [selected, setSelected] = useState<Candle | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const {
    instances,
    computations,
    error: indicatorError,
    loadingMessage,
    addConfigured,
    editIndicator,
    hideToggle,
    removeIndicator,
    retry: retryIndicators,
  } = useIndicators({
    symbol: info?.symbol ?? null,
    interval,
    candles,
    ready: status === "ready",
  });
  const overlayLines = useMemo(() => overlayChartLines(instances, computations), [computations, instances]);
  const paneLines = useMemo(() => paneChartLines(instances, computations), [computations, instances]);
  const overlayInstances = useMemo(
    () => instances.filter((instance) => getIndicatorDefinition(instance.type)?.placement === "overlay"),
    [instances],
  );
  const paneInstancesByGroup = useMemo(() => {
    const groups = new Map<string, typeof instances>();
    for (const instance of instances) {
      const group = getIndicatorDefinition(instance.type)?.paneGroup;
      if (!group) {
        continue;
      }
      const rows = groups.get(group) ?? [];
      rows.push(instance);
      groups.set(group, rows);
    }
    return groups;
  }, [instances]);
  const paneGroupOrder = useMemo(() => visiblePaneGroups(instances), [instances]);
  const [paneHosts, setPaneHosts] = useState<Record<string, HTMLElement | null>>({});
  const [autoScaleToken, setAutoScaleToken] = useState(0);
  const visibleRangeRef = useRef<TimeRangeMs | null>(null);
  const overlayInterval = pendingInterval ?? interval;

  useEffect(() => {
    if (hovered === null && candles.length > 0 && status === "ready") {
      setHovered(candles[candles.length - 1]);
    }
  }, [candles, hovered, status]);

  useEffect(() => {
    if (viewIntent?.centerMs != null && candles.length > 0) {
      const nearest = findNearestCandle(candles, viewIntent.centerMs);
      if (nearest) {
        setSelected(nearest);
        setHovered(nearest);
      }
    }
  }, [viewIntent, candles]);

  const onSelectTimeframe = (next: Timeframe) => {
    setHovered(null);
    setSelected(null);
    changeTimeframe(next, visibleRangeRef.current);
  };

  const onSelectCandle = useCallback(
    (candle: Candle) => {
      setSelected(candle);
      setHovered(candle);
      if (settings.showInspector) {
        setInspectorOpen(true);
      }
    },
    [settings.showInspector],
  );

  const closeInspector = useCallback(() => setInspectorOpen(false), []);
  const closeDate = useCallback(() => setDateOpen(false), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const shortcutHandlers = useMemo(
    () => ({
      fullscreen: () => {
        void toggleFullscreen();
      },
      goToDate: () => setDateOpen(true),
      goToLatest: () => {
        void goToLatest();
      },
      resetView: requestResetView,
    }),
    [goToLatest, requestResetView, toggleFullscreen],
  );
  useChartShortcuts(shortcutHandlers, !dateOpen && !settingsOpen && !indicatorsOpen);

  const historyLabel = loadingOlder
    ? "Loading older candles..."
    : olderError
      ? olderError
      : hasOlder
        ? "Pan left for older candles"
        : "Start of history";

  const showInspectorPanel = inspectorOpen && settings.showInspector;
  const infoCandle = hovered ?? selected;

  return (
    <div
      ref={workspaceRef}
      className="workspace"
      style={{ "--up": settings.upColor, "--down": settings.downColor } as CSSProperties}
    >
      <div className="toolbar-slot">
      <ChartToolbar
        info={info}
        interval={interval}
        pendingInterval={status === "loading" ? pendingInterval : null}
        settings={settings}
        fullscreen={fullscreen}
        inspectorOpen={showInspectorPanel}
        indicatorsOpen={indicatorsOpen}
        onSelectTimeframe={onSelectTimeframe}
        onChartType={(chartType) => updateSettings({ chartType })}
        onGoToDate={() => setDateOpen(true)}
        onGoToLatest={() => {
          void goToLatest();
        }}
        onAutoScale={() => {
          updateSettings({ autoScale: true });
          setAutoScaleToken((token) => token + 1);
        }}
        onToggleLogScale={() => updateSettings({ logScale: !settings.logScale })}
        onResetView={requestResetView}
        onSettings={() => setSettingsOpen(true)}
        onToggleInspector={() => {
          if (!settings.showInspector) {
            updateSettings({ showInspector: true });
            setInspectorOpen(true);
            return;
          }
          setInspectorOpen((open) => !open);
        }}
        onToggleIndicators={() => setIndicatorsOpen((open) => !open)}
        onToggleFullscreen={() => {
          void toggleFullscreen();
        }}
      />
      <IndicatorsPanel
        open={indicatorsOpen}
        instances={instances}
        onClose={() => setIndicatorsOpen(false)}
        onAdd={addConfigured}
        onEdit={editIndicator}
        onToggleVisible={hideToggle}
        onRemove={removeIndicator}
      />
      </div>
      <ChartInfoBar candle={infoCandle} interval={interval} />
      <IndicatorLegend
        instances={overlayInstances}
        computations={computations}
        openTime={infoCandle?.openTime ?? null}
        loadingMessage={overlayInstances.length > 0 ? loadingMessage : null}
        error={overlayInstances.length > 0 ? indicatorError : null}
        onRetry={retryIndicators}
        onRemove={removeIndicator}
      />
      <div className="workspace-body">
        <div className="chart-stage">
          {candles.length > 0 ? (
            <TradingChart
              key={interval}
              candles={candles}
              interval={interval}
              initialTimeRange={restoreRange}
              viewIntent={viewIntent}
              settings={settings}
              selectedOpenTime={selected?.openTime ?? null}
              autoScaleToken={autoScaleToken}
              overlayLines={overlayLines}
              paneLines={paneLines}
              onPaneHostChange={(group, host) => {
                setPaneHosts((current) => (current[group] === host ? current : { ...current, [group]: host }));
              }}
              onHover={setHovered}
              onSelect={onSelectCandle}
              onNeedOlder={() => {
                void loadOlder();
              }}
              onVisibleTimeRangeChange={(range) => {
                visibleRangeRef.current = range;
              }}
              loadingOlder={loadingOlder}
            />
          ) : null}
          {showPrimaryOverlay ? <PrimaryLoadingOverlay interval={overlayInterval} /> : null}
          {status === "error" ? <ChartErrorPanel message={error ?? CHART_LOAD_ERROR} onRetry={retry} /> : null}
          {loadingOlder ? <HistoricalLoadingIndicator /> : null}
        </div>
        {showInspectorPanel ? (
          <CandleInspector candle={selected} interval={interval} onClose={closeInspector} />
        ) : null}
      </div>
      {paneGroupOrder.map((group) => {
        const host = paneHosts[group];
        const groupInstances = paneInstancesByGroup.get(group) ?? [];
        if (!host || groupInstances.length === 0) {
          return null;
        }
        const groupHasError = groupInstances.some((instance) =>
          computations.some((row) => row.output.instanceId === instance.id && row.error),
        );
        return (
          <Fragment key={group}>
            {createPortal(
              <IndicatorLegend
                className="indicator-pane-legend"
                instances={groupInstances}
                computations={computations}
                openTime={infoCandle?.openTime ?? null}
                loadingMessage={loadingMessage}
                error={groupHasError ? indicatorError : overlayInstances.length === 0 ? indicatorError : null}
                onRetry={retryIndicators}
                onRemove={removeIndicator}
              />,
              host,
            )}
          </Fragment>
        );
      })}
      <ChartStatusBar
        candleCount={candles.length}
        totalCount={info?.candleCount ?? null}
        interval={interval}
        overlayInterval={overlayInterval}
        historyLabel={historyLabel}
      />
      <GoToDateDialog
        open={dateOpen}
        interval={interval}
        firstOpenTime={info?.firstOpenTime ?? null}
        lastOpenTime={info?.lastOpenTime ?? null}
        initialTime={hovered?.openTime ?? selected?.openTime ?? info?.lastOpenTime ?? null}
        onClose={closeDate}
        onGo={(timestamp) => {
          setDateOpen(false);
          void goToAnchor(timestamp);
        }}
      />
      <ChartSettingsPanel open={settingsOpen} settings={settings} onClose={closeSettings} onChange={updateSettings} />
    </div>
  );
}
