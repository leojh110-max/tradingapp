import { useEffect, useId, useRef, useState } from "react";
import type { Timeframe } from "../../types/market";
import { formatOpenTime } from "../../utils/format";
import { TIMEFRAME_MS } from "../../utils/timeframes";
import { dateRangeError, formatUtcRange, millisToUtcParts, utcDateTimeToMillis } from "../../utils/utcDate";

type Props = {
  open: boolean;
  interval: Timeframe;
  firstOpenTime: number | null;
  lastOpenTime: number | null;
  initialTime: number | null;
  onClose: () => void;
  onGo: (timestamp: number) => void;
};

export function GoToDateDialog({
  open,
  interval,
  firstOpenTime,
  lastOpenTime,
  initialTime,
  onClose,
  onGo,
}: Props) {
  const titleId = useId();
  const dateRef = useRef<HTMLInputElement | null>(null);
  const seed = millisToUtcParts(initialTime ?? Date.UTC(2021, 4, 19, 12, 0, 0));
  const [date, setDate] = useState(seed.date);
  const [time, setTime] = useState(seed.time);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const parts = millisToUtcParts(initialTime ?? Date.now());
    setDate(parts.date);
    setTime(parts.time);
    setError(null);
    const timer = window.setTimeout(() => dateRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open, initialTime]);

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

  const rangeLabel =
    firstOpenTime !== null && lastOpenTime !== null ? formatUtcRange(firstOpenTime, lastOpenTime) : null;

  const submit = () => {
    const timestamp = utcDateTimeToMillis(date, time);
    if (timestamp === null) {
      setError("Enter a valid UTC date and time.");
      return;
    }
    const rangeError = dateRangeError(timestamp, firstOpenTime, lastOpenTime, TIMEFRAME_MS[interval]);
    if (rangeError) {
      setError(rangeError);
      return;
    }
    onGo(timestamp);
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id={titleId}>Go to Date</h2>
        <label className="field-label">
          Date
          <input ref={dateRef} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="field-label">
          Time
          <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </label>
        <p className="field-hint">Timezone UTC</p>
        {rangeLabel ? <p className="field-hint">Available {rangeLabel}</p> : null}
        {error ? <p className="field-error">{error}</p> : null}
        {firstOpenTime !== null ? (
          <p className="field-hint">First candle {formatOpenTime(firstOpenTime, interval)}</p>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-btn" onClick={submit}>
            Go
          </button>
        </div>
      </div>
    </div>
  );
}
