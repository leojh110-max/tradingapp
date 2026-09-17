import { useEffect, useRef, useState } from "react";

export const PRIMARY_LOADING_DELAY_MS = 200;
export const PRIMARY_LOADING_MIN_VISIBLE_MS = 180;

export function shouldRevealPrimaryOverlay(
  elapsedMs: number,
  delayMs = PRIMARY_LOADING_DELAY_MS,
): boolean {
  return elapsedMs >= delayMs;
}

export function remainingMinVisibleMs(
  visibleForMs: number,
  minVisibleMs = PRIMARY_LOADING_MIN_VISIBLE_MS,
): number {
  return Math.max(0, minVisibleMs - visibleForMs);
}

export function loadingIntervalLabel(interval: string): string {
  return interval.toUpperCase();
}

export const CHART_LOAD_ERROR = "Unable to load chart data";

export function usePrimaryLoadingVisible(isLoading: boolean): boolean {
  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);
  const loadingRef = useRef(isLoading);
  loadingRef.current = isLoading;

  useEffect(() => {
    if (!isLoading) {
      if (shownAtRef.current === null) {
        setVisible(false);
        return undefined;
      }
      const remaining = remainingMinVisibleMs(performance.now() - shownAtRef.current);
      const hideTimer = window.setTimeout(() => {
        if (!loadingRef.current) {
          shownAtRef.current = null;
          setVisible(false);
        }
      }, remaining);
      return () => window.clearTimeout(hideTimer);
    }
    const showTimer = window.setTimeout(() => {
      if (loadingRef.current) {
        shownAtRef.current = performance.now();
        setVisible(true);
      }
    }, PRIMARY_LOADING_DELAY_MS);
    return () => window.clearTimeout(showTimer);
  }, [isLoading]);

  return visible;
}
