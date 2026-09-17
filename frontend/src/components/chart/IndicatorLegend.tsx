import { formatIndicatorValue } from "../../indicators/formatDisplay";
import { instanceLabel } from "../../indicators/instances";
import { getIndicatorDefinition } from "../../indicators/registry";
import type { IndicatorComputation } from "../../indicators/runtime";
import type { IndicatorInstance } from "../../indicators/types";
import { seriesValuesAtTime, valueAtTime } from "../../indicators/engine";

type Props = {
  instances: IndicatorInstance[];
  computations: IndicatorComputation[];
  openTime: number | null;
  loadingMessage: string | null;
  error: string | null;
  onRetry: () => void;
  onRemove: (id: string) => void;
  className?: string;
};

export function IndicatorLegend({
  instances,
  computations,
  openTime,
  loadingMessage,
  error,
  onRetry,
  onRemove,
  className = "indicator-legend",
}: Props) {
  if (instances.length === 0 && !loadingMessage && !error) {
    return null;
  }
  const byId = new Map(computations.map((row) => [row.output.instanceId, row]));
  return (
    <div className={className} aria-live="polite">
      {instances.map((instance) => {
        const run = byId.get(instance.id);
        const series = run?.output.series ?? [];
        const multi = series.length > 1;
        const fallbackKind = getIndicatorDefinition(instance.type)?.valueKind ?? "generic";
        return (
          <span
            key={instance.id}
            className={
              instance.visible
                ? multi
                  ? "indicator-legend-item indicator-legend-block"
                  : "indicator-legend-item"
                : multi
                  ? "indicator-legend-item indicator-legend-block is-hidden"
                  : "indicator-legend-item is-hidden"
            }
            style={{ color: instance.color }}
          >
            <span className="indicator-legend-label">{instanceLabel(instance)}</span>
            {multi ? (
              series.map((row) => {
                const raw =
                  openTime === null || !run || run.error ? null : seriesValuesAtTime(run.output, openTime).find((item) => item.key === row.key)?.value ?? null;
                const display =
                  run?.error || raw === null ? "—" : formatIndicatorValue(raw, row.valueKind ?? fallbackKind);
                return (
                  <span key={row.key} className="indicator-legend-series" style={{ color: seriesLegendColor(instance, row.key) }}>
                    <span className="indicator-legend-series-name">{row.title}</span>
                    <span className="indicator-legend-value">{display}</span>
                  </span>
                );
              })
            ) : (
              <span className="indicator-legend-value">
                {(() => {
                  const raw =
                    openTime === null || !run || run.error ? null : valueAtTime(run.output, openTime);
                  return run?.error || raw === null ? "—" : formatIndicatorValue(raw, fallbackKind);
                })()}
              </span>
            )}
            {run?.error ? (
              <span className="indicator-legend-error">
                {run.error}
                <button type="button" className="ghost-btn ghost-btn-compact" onClick={onRetry}>
                  Retry
                </button>
                <button type="button" className="ghost-btn ghost-btn-compact" onClick={() => onRemove(instance.id)}>
                  Remove
                </button>
              </span>
            ) : null}
          </span>
        );
      })}
      {loadingMessage ? <span className="indicator-legend-status">{loadingMessage}</span> : null}
      {error ? (
        <span className="indicator-legend-error">
          {error}
          <button type="button" className="ghost-btn ghost-btn-compact" onClick={onRetry}>
            Retry
          </button>
          {instances[0] ? (
            <button type="button" className="ghost-btn ghost-btn-compact" onClick={() => onRemove(instances[0].id)}>
              Remove
            </button>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

function seriesLegendColor(instance: IndicatorInstance, seriesKey: string): string {
  if (seriesKey === "signal" && instance.signalColor) {
    return instance.signalColor;
  }
  if (seriesKey === "histogram" && instance.histogramPositiveColor) {
    return instance.histogramPositiveColor;
  }
  return instance.color;
}
