import type { StorageLike } from "../utils/chartSettings";
import { INDICATORS_STORAGE_KEY, type IndicatorInstance } from "./types";
import { parseStoredInstances } from "./validation";

export function loadIndicatorInstances(storage: StorageLike | null = defaultStorage()): IndicatorInstance[] {
  if (storage === null) {
    return [];
  }
  try {
    const raw = storage.getItem(INDICATORS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    return parseStoredInstances(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveIndicatorInstances(
  instances: IndicatorInstance[],
  storage: StorageLike | null = defaultStorage(),
): void {
  if (storage === null) {
    return;
  }
  storage.setItem(INDICATORS_STORAGE_KEY, JSON.stringify({ version: 1, instances }));
}

function defaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage === "undefined") {
      return null;
    }
    return localStorage;
  } catch {
    return null;
  }
}
