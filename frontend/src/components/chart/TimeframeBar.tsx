import type { Timeframe } from "../../types/market";
import { timeframeButtonState } from "../../utils/requestIdentity";
import { TIMEFRAMES } from "../../utils/timeframes";

type Props = {
  active: Timeframe;
  pending?: Timeframe | null;
  onSelect: (timeframe: Timeframe) => void;
};

export function TimeframeBar({ active, pending = null, onSelect }: Props) {
  return (
    <div className="timeframe-bar" role="tablist" aria-label="Timeframe">
      {TIMEFRAMES.map((timeframe) => {
        const { selected, loading } = timeframeButtonState(timeframe, active, pending);
        const className = ["tf-btn", selected ? "tf-btn-active" : "", loading ? "tf-btn-loading" : ""]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={timeframe}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-busy={loading}
            className={className}
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
