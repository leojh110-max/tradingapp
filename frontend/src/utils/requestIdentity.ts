export function isCurrentRequest(activeId: number, responseId: number): boolean {
  return activeId === responseId;
}

export function nextRequestId(currentId: number): number {
  return currentId + 1;
}

export function timeframeButtonState(
  timeframe: string,
  displayed: string,
  pending: string | null,
): { selected: boolean; loading: boolean } {
  const target = pending ?? displayed;
  return {
    selected: timeframe === target,
    loading: pending === timeframe,
  };
}
