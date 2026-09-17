import { useState } from "react";
import { loadChartSettings, saveChartSettings, type ChartSettings } from "../utils/chartSettings";

export function useChartSettings() {
  const [settings, setSettings] = useState<ChartSettings>(() => loadChartSettings());

  const updateSettings = (patch: Partial<ChartSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      saveChartSettings(next);
      return next;
    });
  };

  return { settings, updateSettings };
}
