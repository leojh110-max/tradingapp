import { useEffect, useId } from "react";
import type { ChartSettings } from "../../utils/chartSettings";

type Props = {
  open: boolean;
  settings: ChartSettings;
  onClose: () => void;
  onChange: (patch: Partial<ChartSettings>) => void;
};

export function ChartSettingsPanel({ open, settings, onClose, onChange }: Props) {
  const titleId = useId();

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

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal-card modal-card-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id={titleId}>Chart Settings</h2>
        <section className="settings-section">
          <h3>Appearance</h3>
          <Toggle label="Show Grid" checked={settings.showGrid} onChange={(showGrid) => onChange({ showGrid })} />
          <Toggle label="Show Volume" checked={settings.showVolume} onChange={(showVolume) => onChange({ showVolume })} />
          <Toggle
            label="Show Crosshair"
            checked={settings.showCrosshair}
            onChange={(showCrosshair) => onChange({ showCrosshair })}
          />
        </section>
        <section className="settings-section">
          <h3>Candles</h3>
          <label className="field-label">
            Up Color
            <input
              type="color"
              value={settings.upColor}
              onChange={(event) => onChange({ upColor: event.target.value })}
            />
          </label>
          <label className="field-label">
            Down Color
            <input
              type="color"
              value={settings.downColor}
              onChange={(event) => onChange({ downColor: event.target.value })}
            />
          </label>
        </section>
        <section className="settings-section">
          <h3>Scale</h3>
          <Toggle label="Auto Scale" checked={settings.autoScale} onChange={(autoScale) => onChange({ autoScale })} />
          <Toggle label="Log Scale" checked={settings.logScale} onChange={(logScale) => onChange({ logScale })} />
        </section>
        <section className="settings-section">
          <h3>Interface</h3>
          <Toggle
            label="Show Candle Inspector"
            checked={settings.showInspector}
            onChange={(showInspector) => onChange({ showInspector })}
          />
        </section>
        <div className="modal-actions">
          <button type="button" className="primary-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
