import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import TourOverlay, { type HighlightRect } from "./TourOverlay.js";
import TourTooltip from "./TourTooltip.js";

type RouteKind = "exact" | "course-detail";

export interface TourStep {
  id: string;
  route: string;
  targetId: string;
  title: string;
  body: string;
  routeKind?: RouteKind;
  interactive?: {
    actionLabel: string;
    completionQueryKey?: string[];
    completionCheck?: () => boolean;
  };
}

interface GuidedTourProps {
  isOpen: boolean;
  steps: TourStep[];
  currentIndex: number;
  isBusy?: boolean;
  interactionComplete?: boolean;
  onInteractionComplete?: () => void;
  onNext: () => void | Promise<void>;
  onSkip: () => void | Promise<void>;
}

function normalizePath(pathname: string) {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized || "/";
}

function isCourseDetailPath(pathname: string) {
  return /^\/catalog\/[^/]+$/.test(normalizePath(pathname));
}

function toRect(rect: DOMRect): HighlightRect {
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function routeMatches(step: TourStep, pathname: string) {
  if (step.routeKind === "course-detail") return isCourseDetailPath(pathname);
  return normalizePath(pathname) === normalizePath(step.route);
}

function findFirstCatalogCourseHref() {
  const links = Array.from(
    document.querySelectorAll<HTMLAnchorElement>('main a[href^="/catalog/"]')
  );
  for (const link of links) {
    const href = link.getAttribute("href");
    if (href && /^\/catalog\/[^/?#]+$/.test(href)) return href;
  }
  return null;
}

export default function GuidedTour({
  isOpen,
  steps,
  currentIndex,
  isBusy = false,
  interactionComplete = false,
  onInteractionComplete,
  onNext,
  onSkip,
}: GuidedTourProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentStep = isOpen ? steps[currentIndex] : null;
  const [targetRect, setTargetRect] = useState<HighlightRect | null>(null);
  const isInteractive = !!currentStep?.interactive;

  // Target element discovery & position tracking
  useEffect(() => {
    if (!isOpen || !currentStep) {
      setTargetRect(null);
      return;
    }

    let cancelled = false;
    let retryId: number | undefined;
    let removeWatchers: (() => void) | null = null;
    let attempts = 0;

    setTargetRect(null);

    const clearWatchers = () => {
      if (removeWatchers) {
        removeWatchers();
        removeWatchers = null;
      }
    };

    const retry = () => {
      attempts += 1;
      if (cancelled || attempts > 120) return;
      retryId = window.setTimeout(run, 180);
    };

    const watchTarget = (target: HTMLElement) => {
      clearWatchers();

      const updateRect = () => {
        if (cancelled) return;
        const rect = target.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        setTargetRect(toRect(rect));
      };

      updateRect();
      window.addEventListener("resize", updateRect);
      window.addEventListener("scroll", updateRect, true);

      let observer: ResizeObserver | null = null;
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(() => updateRect());
        observer.observe(target);
      }

      removeWatchers = () => {
        window.removeEventListener("resize", updateRect);
        window.removeEventListener("scroll", updateRect, true);
        observer?.disconnect();
      };
    };

    const run = () => {
      if (cancelled) return;

      const pathname = location.pathname;
      if (!routeMatches(currentStep, pathname)) {
        if (currentStep.routeKind === "course-detail") {
          if (normalizePath(pathname) === "/catalog") {
            const firstCourseHref = findFirstCatalogCourseHref();
            if (firstCourseHref) {
              navigate(firstCourseHref);
              return;
            }
            retry();
            return;
          }
          navigate("/catalog");
          return;
        }

        navigate(currentStep.route);
        return;
      }

      const selector = `[data-tour-id="${currentStep.targetId}"]`;
      const target = document.querySelector<HTMLElement>(selector);
      if (!target) {
        retry();
        return;
      }

      target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      watchTarget(target);
    };

    run();

    return () => {
      cancelled = true;
      if (retryId) window.clearTimeout(retryId);
      clearWatchers();
    };
  }, [currentStep, isOpen, location.pathname, navigate]);

  // Query cache subscription for interactive steps with completionQueryKey
  useEffect(() => {
    if (!isOpen || !currentStep?.interactive?.completionQueryKey || interactionComplete) return;
    if (!onInteractionComplete) return;

    const targetKey = currentStep.interactive.completionQueryKey;
    const cache = queryClient.getQueryCache();

    // Record the current dataUpdatedAt so we only trigger on new fetches.
    const existing = cache.findAll({ queryKey: targetKey })[0];
    const initialTimestamp = existing?.state.dataUpdatedAt ?? 0;

    const unsubscribe = cache.subscribe((event) => {
      if (!event?.query) return;
      const qk = event.query.queryKey;
      if (targetKey.every((part, i) => qk[i] === part)) {
        if (event.query.state.dataUpdatedAt > initialTimestamp) {
          onInteractionComplete();
        }
      }
    });

    return unsubscribe;
  }, [currentStep, isOpen, interactionComplete, queryClient, onInteractionComplete]);

  // DOM polling for interactive steps with completionCheck
  useEffect(() => {
    if (!isOpen || !currentStep?.interactive?.completionCheck || interactionComplete) return;
    if (!onInteractionComplete) return;

    const check = currentStep.interactive.completionCheck;
    const id = window.setInterval(() => {
      if (check()) onInteractionComplete();
    }, 500);

    return () => window.clearInterval(id);
  }, [currentStep, isOpen, interactionComplete, onInteractionComplete]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        void onSkip();
      } else if (event.key === "ArrowRight") {
        // Block advance on interactive steps until interaction is complete.
        if (isInteractive && !interactionComplete) return;
        event.preventDefault();
        void onNext();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isInteractive, interactionComplete, onNext, onSkip]);

  if (!isOpen || !currentStep) return null;

  return (
    <>
      <TourOverlay rect={targetRect} isInteractive={isInteractive} />
      <TourTooltip
        title={currentStep.title}
        body={currentStep.body}
        progressText={`${currentIndex + 1} of ${steps.length}`}
        targetRect={targetRect}
        isLastStep={currentIndex === steps.length - 1}
        isBusy={isBusy}
        isInteractive={isInteractive}
        isInteractionComplete={interactionComplete}
        actionLabel={currentStep.interactive?.actionLabel}
        onNext={onNext}
        onSkip={onSkip}
      />
    </>
  );
}
