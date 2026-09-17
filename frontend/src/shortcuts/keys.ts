export type ChartShortcut = "fullscreen" | "goToDate" | "goToLatest" | "resetView";

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function isTypingTarget(target: EventTarget | null): boolean {
  if (target === null || typeof target !== "object") {
    return false;
  }
  const element = target as { tagName?: string; isContentEditable?: boolean };
  if (element.isContentEditable) {
    return true;
  }
  return typeof element.tagName === "string" && TYPING_TAGS.has(element.tagName);
}

export function matchChartShortcut(event: KeyboardEvent): ChartShortcut | null {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return null;
  }
  if (isTypingTarget(event.target)) {
    return null;
  }
  switch (event.key) {
    case "f":
    case "F":
      return "fullscreen";
    case "g":
    case "G":
      return "goToDate";
    case "l":
    case "L":
      return "goToLatest";
    case "r":
    case "R":
      return "resetView";
    default:
      return null;
  }
}
