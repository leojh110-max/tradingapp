import type { Timeframe } from "../../types/market";
import { TIMEFRAMES } from "../../utils/timeframes";

type Props = {
  active: Timeframe;
  onSelect: (timeframe: Timeframe) => void;
};

export function TimeframeBar({ active, onSelect }: Props) {
  return (
    <div className="timeframe-bar" role="tablist" aria-label="Timeframe">
      {TIMEFRAMES.map((timeframe) => {
        const selected = timeframe === active;
        return (
          <button
            key={timeframe}
            type="button"
            role="tab"
            aria-selected={selected}
            className={selected ? "tf-btn tf-btn-active" : "tf-btn"}
            title={timeframe === "1d" ? "1 day UTC" : timeframe}
            onClick={() => onSelect(timeframe)}
          >
            {timeframe}
          </button>
        );
      })}
    </div>
  );
}
