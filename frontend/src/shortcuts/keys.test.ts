import { describe, expect, it } from "vitest";
import { isTypingTarget, matchChartShortcut } from "./keys";

function keyEvent(key: string, target: EventTarget | null = null, extra: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    target,
    ...extra,
  } as KeyboardEvent;
}

describe("chart shortcuts", () => {
  it("maps the Phase 2-D keys and ignores replay-reserved keys", () => {
    expect(matchChartShortcut(keyEvent("g"))).toBe("goToDate");
    expect(matchChartShortcut(keyEvent("l"))).toBe("goToLatest");
    expect(matchChartShortcut(keyEvent("r"))).toBe("resetView");
    expect(matchChartShortcut(keyEvent("f"))).toBe("fullscreen");
    expect(matchChartShortcut(keyEvent(" "))).toBeNull();
    expect(matchChartShortcut(keyEvent("ArrowLeft"))).toBeNull();
    expect(matchChartShortcut(keyEvent("ArrowRight"))).toBeNull();
  });

  it("does not fire while typing in an input", () => {
    const input = { tagName: "INPUT", isContentEditable: false } as HTMLElement;
    expect(isTypingTarget(input)).toBe(true);
    expect(matchChartShortcut(keyEvent("g", input))).toBeNull();
  });

  it("ignores modified keys so browser chords stay intact", () => {
    expect(matchChartShortcut(keyEvent("f", null, { ctrlKey: true }))).toBeNull();
  });
});
