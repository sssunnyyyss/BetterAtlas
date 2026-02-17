import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../../api/client.js";
import { useAuth } from "../../lib/auth.js";
import GuidedTour, { type TourStep } from "./GuidedTour.js";
import WelcomeModal from "./WelcomeModal.js";

interface OnboardingContextValue {
  startTour: () => void;
  restartTour: () => void;
  restartIntro: () => void;
  isTourActive: boolean;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

const TOUR_STEPS: TourStep[] = [
  {
    id: "catalog-search-filters",
    route: "/catalog",
    targetId: "catalog-search-filters",
    title: "Start in Catalog",
    body: "Use filters and search together to narrow from broad ideas to specific classes quickly.",
  },
  {
    id: "catalog-ai-entry",
    route: "/catalog",
    targetId: "catalog-ai-entry",
    title: "Ask AI for Suggestions",
    body: "Switch to Ask AI when you want recommendation-style guidance instead of keyword filtering.",
  },
  {
    id: "course-detail-reviews",
    route: "/catalog",
    routeKind: "course-detail",
    targetId: "course-detail-reviews",
    title: "Read and Write Reviews",
    body: "Check review quality before you commit, then add your own feedback after taking a class.",
  },
  {
    id: "schedule-grid",
    route: "/schedule",
    targetId: "schedule-grid",
    title: "Build Your Week",
    body: "The weekly grid helps you spot conflicts and balance your classes across the week.",
  },
  {
    id: "friends-add-list",
    route: "/friends",
    targetId: "friends-add-list",
    title: "Connect with Friends",
    body: "Send requests, manage your network, and quickly jump to your friends' public course lists.",
  },
  {
    id: "profile-badge-area",
    route: "/profile",
    targetId: "profile-badge-area",
    title: "Track Your Progress",
    body: "Your profile stores badges and activity history so you can revisit progress anytime.",
  },
];

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user, refresh } = useAuth();
  const [hasDismissedWelcome, setHasDismissedWelcome] = useState(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSavingTourState, setIsSavingTourState] = useState(false);

  useEffect(() => {
    if (!user) {
      setHasDismissedWelcome(false);
      setIsWelcomeOpen(false);
      setIsTourOpen(false);
      setCurrentStepIndex(0);
      setIsSavingTourState(false);
      return;
    }

    if (user.hasCompletedOnboarding === false && !hasDismissedWelcome && !isTourOpen) {
      setIsWelcomeOpen(true);
      return;
    }

    if (user.hasCompletedOnboarding !== false) {
      setIsWelcomeOpen(false);
    }
  }, [hasDismissedWelcome, isTourOpen, user]);

  const openTour = useCallback(() => {
    if (!user) return;
    setHasDismissedWelcome(true);
    setIsWelcomeOpen(false);
    setCurrentStepIndex(0);
    setIsTourOpen(true);
  }, [user]);

  const closeWelcomeForNow = useCallback(() => {
    setHasDismissedWelcome(true);
    setIsWelcomeOpen(false);
  }, []);

  const restartIntro = useCallback(() => {
    if (!user) return;
    setIsTourOpen(false);
    setCurrentStepIndex(0);
    setHasDismissedWelcome(false);
    setIsWelcomeOpen(true);
  }, [user]);

  const persistOnboardingCompletion = useCallback(async () => {
    if (!user || isSavingTourState) return;

    setIsSavingTourState(true);
    try {
      await api.patch<unknown>("/users/me/onboarding");
    } catch {
      // Keep the UX moving even if this request fails transiently.
    } finally {
      try {
        await refresh();
      } catch {
        // Ignore refresh failures; auth context will retry on next lifecycle events.
      }
      setIsSavingTourState(false);
    }
  }, [isSavingTourState, refresh, user]);

  const handleTourSkip = useCallback(async () => {
    setIsTourOpen(false);
    setCurrentStepIndex(0);
    await persistOnboardingCompletion();
  }, [persistOnboardingCompletion]);

  const handleTourNext = useCallback(async () => {
    if (currentStepIndex >= TOUR_STEPS.length - 1) {
      setIsTourOpen(false);
      setCurrentStepIndex(0);
      await persistOnboardingCompletion();
      return;
    }

    setCurrentStepIndex((current) => Math.min(current + 1, TOUR_STEPS.length - 1));
  }, [currentStepIndex, persistOnboardingCompletion]);

  const contextValue = useMemo<OnboardingContextValue>(
    () => ({
      startTour: openTour,
      restartTour: openTour,
      restartIntro,
      isTourActive: isTourOpen,
    }),
    [isTourOpen, openTour, restartIntro]
  );

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
      {user && (
        <>
          <WelcomeModal
            isOpen={isWelcomeOpen}
            onTakeTour={openTour}
            onSkipForNow={closeWelcomeForNow}
          />
          <GuidedTour
            isOpen={isTourOpen}
            steps={TOUR_STEPS}
            currentIndex={currentStepIndex}
            isBusy={isSavingTourState}
            onNext={handleTourNext}
            onSkip={handleTourSkip}
          />
        </>
      )}
    </OnboardingContext.Provider>
  );
}

export default OnboardingProvider;

export function useOnboarding() {
  const value = useContext(OnboardingContext);
  if (!value) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return value;
}
