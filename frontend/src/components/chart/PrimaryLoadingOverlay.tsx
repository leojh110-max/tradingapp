import { loadingIntervalLabel } from "../../utils/loadingOverlay";

type Props = {
  interval: string;
};

export function PrimaryLoadingOverlay({ interval }: Props) {
  return (
    <div className="chart-loading-overlay" role="status" aria-live="polite">
      <div className="chart-loading-card">
        <span className="chart-spinner" aria-hidden="true" />
        <div className="chart-loading-copy">
          <p className="chart-loading-title">Loading {loadingIntervalLabel(interval)} candles...</p>
          <p className="chart-loading-subtitle">Loading from local market data</p>
        </div>
      </div>
    </div>
  );
}
