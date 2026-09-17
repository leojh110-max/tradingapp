type Props = {
  message: string;
  onRetry: () => void;
};

export function ChartErrorPanel({ message, onRetry }: Props) {
  return (
    <div className="chart-error-overlay" role="alert">
      <div className="chart-error-card">
        <p className="chart-error-title">{message}</p>
        <button type="button" className="chart-retry-btn" onClick={onRetry}>
          Retry
        </button>
      </div>
    </div>
  );
}
