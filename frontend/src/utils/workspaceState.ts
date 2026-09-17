import type { Candle } from "../types/market";

export function selectionFromClick(
  candle: Candle,
  showInspector: boolean,
): { selectedOpenTime: number; inspectorOpen: boolean } {
  return {
    selectedOpenTime: candle.openTime,
    inspectorOpen: showInspector,
  };
}

export function chartTypeChangeReloadsData(): boolean {
  return false;
}
