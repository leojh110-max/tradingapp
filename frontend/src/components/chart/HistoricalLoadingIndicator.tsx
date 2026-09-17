export function HistoricalLoadingIndicator() {
  return (
    <div className="history-loading-badge" role="status" aria-live="polite">
      <span className="chart-spinner chart-spinner-sm" aria-hidden="true" />
      <span>Loading older candles...</span>
    </div>
  );
}
