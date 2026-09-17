import { useEffect, useRef } from "react";
import { matchChartShortcut, type ChartShortcut } from "./keys";

export function useChartShortcuts(handlers: Partial<Record<ChartShortcut, () => void>>, enabled = true): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const action = matchChartShortcut(event);
      if (action === null) {
        return;
      }
      const handler = handlersRef.current[action];
      if (!handler) {
        return;
      }
      event.preventDefault();
      handler();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
