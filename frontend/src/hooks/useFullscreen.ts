import { useCallback, useEffect, useState } from "react";

export function useFullscreen(targetRef: { current: HTMLElement | null }) {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => {
      setFullscreen(document.fullscreenElement === targetRef.current);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [targetRef]);

  const toggle = useCallback(async () => {
    const node = targetRef.current;
    if (!node) {
      return;
    }
    try {
      if (document.fullscreenElement === node) {
        await document.exitFullscreen();
      } else {
        await node.requestFullscreen();
      }
    } catch {
      // Browser may reject fullscreen without a user gesture.
    }
  }, [targetRef]);

  return { fullscreen, toggle };
}
