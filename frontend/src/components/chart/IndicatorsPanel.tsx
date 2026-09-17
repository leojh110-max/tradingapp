import { useEffect, useId, useMemo, useState } from "react";
import { instanceLabel, nextIndicatorColor } from "../../indicators/instances";
import { listIndicatorDefinitions } from "../../indicators/registry";
import type { IndicatorInstance, IndicatorSource, IndicatorTypeId } from "../../indicators/types";
import {
  INDICATOR_SOURCES,
  MACD_DEFAULT_HIST_NEGATIVE,
  MACD_DEFAULT_HIST_POSITIVE,
  MACD_DEFAULT_SIGNAL_COLOR,
} from "../../indicators/types";
import { canAddInstance, parseMacdLengths, parsePeriod, parseRsiLevels } from "../../indicators/validation";
import { IconClose } from "./ChartIcons";

type Draft = {
  type: IndicatorTypeId;
  period: string;
  source: IndicatorSource;
  color: string;
  lineWidth: number;
  overbought: string;
  oversold: string;
  fastPeriod: string;
  slowPeriod: string;
  signalPeriod: string;
  signalColor: string;
  histogramPositiveColor: string;
  histogramNegativeColor: string;
};

type Props = {
  open: boolean;
  instances: IndicatorInstance[];
  onClose: () => void;
  onAdd: (draft: Omit<IndicatorInstance, "id">) => { ok: true } | { ok: false; message: string };
  onEdit: (id: string, patch: Partial<Omit<IndicatorInstance, "id" | "type">>) => void;
  onToggleVisible: (id: string) => void;
  onRemove: (id: string) => void;
};

export function IndicatorsPanel({
  open,
  instances,
  onClose,
  onAdd,
  onEdit,
  onToggleVisible,
  onRemove,
}: Props) {
  const titleId = useId();
  const [mode, setMode] = useState<"list" | "form">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(() => defaultDraft(instances.length));
  const [formError, setFormError] = useState<string | null>(null);
  const [limitError, setLimitError] = useState<string | null>(null);
  const definitions = useMemo(() => listIndicatorDefinitions(), []);
  const categories = useMemo(() => {
    const groups: { category: string; items: typeof definitions }[] = [];
    for (const definition of definitions) {
      const existing = groups.find((group) => group.category === definition.category);
      if (existing) {
        existing.items.push(definition);
      } else {
        groups.push({ category: definition.category, items: [definition] });
      }
    }
    return groups;
  }, [definitions]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      if (target.closest(".indicators-popover") || target.closest('[aria-label="Indicators"]')) {
        return;
      }
      onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setMode("list");
      setEditingId(null);
      setFormError(null);
      setLimitError(null);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const startAdd = (type: IndicatorTypeId) => {
    const allowed = canAddInstance(instances.length);
    if (!allowed.ok) {
      setLimitError(allowed.message);
      return;
    }
    setLimitError(null);
    setFormError(null);
    setEditingId(null);
    setDraft(defaultDraft(instances.length, type));
    setMode("form");
  };

  const startEdit = (row: IndicatorInstance) => {
    setLimitError(null);
    setFormError(null);
    setEditingId(row.id);
    setDraft({
      type: row.type,
      period: String(row.period),
      source: row.source,
      color: row.color,
      lineWidth: row.lineWidth,
      overbought: String(row.overbought ?? 70),
      oversold: String(row.oversold ?? 30),
      fastPeriod: String(row.fastPeriod ?? 12),
      slowPeriod: String(row.slowPeriod ?? (row.type === "macd" ? row.period : 26)),
      signalPeriod: String(row.signalPeriod ?? 9),
      signalColor: row.signalColor ?? MACD_DEFAULT_SIGNAL_COLOR,
      histogramPositiveColor: row.histogramPositiveColor ?? MACD_DEFAULT_HIST_POSITIVE,
      histogramNegativeColor: row.histogramNegativeColor ?? MACD_DEFAULT_HIST_NEGATIVE,
    });
    setMode("form");
  };

  const submit = () => {
    if (draft.type === "macd") {
      const lengths = parseMacdLengths(draft.fastPeriod, draft.slowPeriod, draft.signalPeriod);
      if (!lengths.ok) {
        setFormError(lengths.message);
        return;
      }
      setFormError(null);
      const patch = {
        period: lengths.slowPeriod,
        source: draft.source,
        color: draft.color,
        lineWidth: draft.lineWidth,
        fastPeriod: lengths.fastPeriod,
        slowPeriod: lengths.slowPeriod,
        signalPeriod: lengths.signalPeriod,
        signalColor: draft.signalColor,
        histogramPositiveColor: draft.histogramPositiveColor,
        histogramNegativeColor: draft.histogramNegativeColor,
      };
      if (editingId) {
        onEdit(editingId, patch);
        setMode("list");
        setEditingId(null);
        return;
      }
      const result = onAdd({
        type: draft.type,
        ...patch,
        visible: true,
      });
      if (!result.ok) {
        setLimitError(result.message);
        return;
      }
      setMode("list");
      return;
    }
    const parsed = parsePeriod(draft.period);
    if (!parsed.ok) {
      setFormError(parsed.message);
      return;
    }
    let overbought: number | undefined;
    let oversold: number | undefined;
    if (draft.type === "rsi") {
      const levels = parseRsiLevels(draft.oversold, draft.overbought);
      if (!levels.ok) {
        setFormError(levels.message);
        return;
      }
      overbought = levels.overbought;
      oversold = levels.oversold;
    }
    setFormError(null);
    const patch = {
      period: parsed.value,
      source: draft.source,
      color: draft.color,
      lineWidth: draft.lineWidth,
      overbought,
      oversold,
    };
    if (editingId) {
      onEdit(editingId, patch);
      setMode("list");
      setEditingId(null);
      return;
    }
    const result = onAdd({
      type: draft.type,
      ...patch,
      visible: true,
    });
    if (!result.ok) {
      setLimitError(result.message);
      return;
    }
    setMode("list");
  };

  return (
    <div className="indicators-popover" role="dialog" aria-modal="false" aria-labelledby={titleId}>
      <div className="indicators-popover-header">
        <h2 id={titleId}>Indicators</h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          <IconClose />
        </button>
      </div>
      {mode === "list" ? (
        <>
          {categories.map((group) => (
            <div key={group.category}>
              <p className="indicators-kicker">{group.category}</p>
              <div className="indicator-catalog">
                {group.items.map((definition) => (
                  <button
                    key={definition.id}
                    type="button"
                    className="indicator-catalog-btn"
                    onClick={() => startAdd(definition.id)}
                  >
                    <strong>{definition.shortName}</strong>
                    <span>{definition.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {limitError ? <p className="field-error">{limitError}</p> : null}
          {instances.length > 0 ? (
            <ul className="indicator-active-list">
              {instances.map((row) => (
                <li key={row.id} className="indicator-active-row">
                  <span className="indicator-swatch" style={{ background: row.color }} />
                  <span className={row.visible ? "indicator-active-label" : "indicator-active-label is-hidden"}>
                    {instanceLabel(row)}
                  </span>
                  <button type="button" className="ghost-btn ghost-btn-compact" onClick={() => startEdit(row)}>
                    Edit
                  </button>
                  <button type="button" className="ghost-btn ghost-btn-compact" onClick={() => onToggleVisible(row.id)}>
                    {row.visible ? "Hide" : "Show"}
                  </button>
                  <button type="button" className="ghost-btn ghost-btn-compact" onClick={() => onRemove(row.id)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="field-hint">No active indicators</p>
          )}
        </>
      ) : (
        <form
          className="indicator-form"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label className="field-label">
            Type
            <input value={draft.type.toUpperCase()} readOnly />
          </label>
          {draft.type === "macd" ? (
            <>
              <label className="field-label">
                Fast Length
                <input
                  value={draft.fastPeriod}
                  inputMode="numeric"
                  autoComplete="off"
                  onChange={(event) => setDraft((current) => ({ ...current, fastPeriod: event.target.value }))}
                />
              </label>
              <label className="field-label">
                Slow Length
                <input
                  value={draft.slowPeriod}
                  inputMode="numeric"
                  autoComplete="off"
                  onChange={(event) => setDraft((current) => ({ ...current, slowPeriod: event.target.value }))}
                />
              </label>
              <label className="field-label">
                Signal Length
                <input
                  value={draft.signalPeriod}
                  inputMode="numeric"
                  autoComplete="off"
                  onChange={(event) => setDraft((current) => ({ ...current, signalPeriod: event.target.value }))}
                />
              </label>
            </>
          ) : (
            <label className="field-label">
              Period
              <input
                value={draft.period}
                inputMode="numeric"
                autoComplete="off"
                onChange={(event) => setDraft((current) => ({ ...current, period: event.target.value }))}
              />
            </label>
          )}
          <label className="field-label">
            Source
            <select
              value={draft.source}
              onChange={(event) =>
                setDraft((current) => ({ ...current, source: event.target.value as IndicatorSource }))
              }
            >
              {INDICATOR_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {source.charAt(0).toUpperCase() + source.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            {draft.type === "macd" ? "MACD Color" : "Color"}
            <input
              type="color"
              value={draft.color}
              onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))}
            />
          </label>
          {draft.type === "macd" ? (
            <>
              <label className="field-label">
                Signal Color
                <input
                  type="color"
                  value={draft.signalColor}
                  onChange={(event) => setDraft((current) => ({ ...current, signalColor: event.target.value }))}
                />
              </label>
              <label className="field-label">
                Histogram Positive
                <input
                  type="color"
                  value={draft.histogramPositiveColor}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, histogramPositiveColor: event.target.value }))
                  }
                />
              </label>
              <label className="field-label">
                Histogram Negative
                <input
                  type="color"
                  value={draft.histogramNegativeColor}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, histogramNegativeColor: event.target.value }))
                  }
                />
              </label>
            </>
          ) : null}
          <label className="field-label">
            Line Width
            <select
              value={draft.lineWidth}
              onChange={(event) =>
                setDraft((current) => ({ ...current, lineWidth: Number(event.target.value) }))
              }
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </label>
          {draft.type === "rsi" ? (
            <>
              <label className="field-label">
                Overbought
                <input
                  value={draft.overbought}
                  inputMode="decimal"
                  autoComplete="off"
                  onChange={(event) => setDraft((current) => ({ ...current, overbought: event.target.value }))}
                />
              </label>
              <label className="field-label">
                Oversold
                <input
                  value={draft.oversold}
                  inputMode="decimal"
                  autoComplete="off"
                  onChange={(event) => setDraft((current) => ({ ...current, oversold: event.target.value }))}
                />
              </label>
            </>
          ) : null}
          {formError ? <p className="field-error">{formError}</p> : null}
          <div className="modal-actions">
            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                setMode("list");
                setEditingId(null);
              }}
            >
              Cancel
            </button>
            <button type="submit" className="primary-btn">
              {editingId ? "Apply" : "Add"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function defaultDraft(existingCount: number, type: IndicatorTypeId = "ema"): Draft {
  const definition = listIndicatorDefinitions().find((row) => row.id === type);
  return {
    type,
    period: String(definition?.defaultSettings.period ?? 20),
    source: definition?.defaultSettings.source ?? "close",
    color: nextIndicatorColor(existingCount),
    lineWidth: definition?.defaultSettings.lineWidth ?? 2,
    overbought: String(definition?.defaultSettings.overbought ?? 70),
    oversold: String(definition?.defaultSettings.oversold ?? 30),
    fastPeriod: String(definition?.defaultSettings.fastPeriod ?? 12),
    slowPeriod: String(definition?.defaultSettings.slowPeriod ?? 26),
    signalPeriod: String(definition?.defaultSettings.signalPeriod ?? 9),
    signalColor: definition?.defaultSettings.signalColor ?? MACD_DEFAULT_SIGNAL_COLOR,
    histogramPositiveColor: definition?.defaultSettings.histogramPositiveColor ?? MACD_DEFAULT_HIST_POSITIVE,
    histogramNegativeColor: definition?.defaultSettings.histogramNegativeColor ?? MACD_DEFAULT_HIST_NEGATIVE,
  };
}
