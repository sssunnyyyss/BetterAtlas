import { useEffect, useState } from "react";

export type ComposerViewportMetrics = {
  keyboardInset: number;
  viewportHeight: number;
};

const MIN_INSET = 0;

function getViewportMetrics(): ComposerViewportMetrics {
  if (typeof window === "undefined") {
    return { keyboardInset: MIN_INSET, viewportHeight: 0 };
  }

  const visualViewport = window.visualViewport;
  if (!visualViewport) {
    return {
      keyboardInset: MIN_INSET,
      viewportHeight: window.innerHeight,
    };
  }

  const viewportHeight = Math.max(MIN_INSET, Math.round(visualViewport.height));
  const viewportBottom = visualViewport.offsetTop + viewportHeight;
  const keyboardInset = Math.max(
    MIN_INSET,
    Math.round(window.innerHeight - viewportBottom),
  );

  return {
    keyboardInset,
    viewportHeight,
  };
}

function areMetricsEqual(
  previous: ComposerViewportMetrics,
  next: ComposerViewportMetrics,
): boolean {
  return (
    previous.keyboardInset === next.keyboardInset &&
    previous.viewportHeight === next.viewportHeight
  );
}

export function useComposerViewport(): ComposerViewportMetrics {
  const [metrics, setMetrics] = useState<ComposerViewportMetrics>(() =>
    getViewportMetrics(),
  );

  useEffect(() => {
    const syncMetrics = () => {
      const next = getViewportMetrics();
      setMetrics((previous) =>
        areMetricsEqual(previous, next) ? previous : next,
      );
    };

    syncMetrics();

    window.addEventListener("resize", syncMetrics);

    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener("resize", syncMetrics);
    visualViewport?.addEventListener("scroll", syncMetrics);

    return () => {
      window.removeEventListener("resize", syncMetrics);
      visualViewport?.removeEventListener("resize", syncMetrics);
      visualViewport?.removeEventListener("scroll", syncMetrics);
    };
  }, []);

  return metrics;
}
