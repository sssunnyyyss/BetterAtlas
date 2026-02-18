import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
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
  {
    id: "friends-add-friend",
    route: "/friends",
    targetId: "friends-add-form",
    title: "Add Your First Friend",
    body: "Search for johndoe, click their profile, and hit Add Friend — they already have a schedule loaded.",
    interactive: {
      actionLabel: "Search johndoe, open their profile, and click Add Friend",
      completionQueryKey: ["friends"],
    },
  },
  {
    id: "schedule-friend-view",
    route: "/schedule",
    targetId: "schedule-friend-toggle",
    title: "See Friend Schedules",
    body: "Toggle Friend view to see John Doe's courses on your calendar.",
    interactive: {
      actionLabel: "Check the Friend view box",
      completionCheck: () => {
        const label = document.querySelector('[data-tour-id="schedule-friend-toggle"]');
        const checkbox = label?.querySelector('input[type="checkbox"]');
        return checkbox instanceof HTMLInputElement && checkbox.checked;
      },
    },
  },
];

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [hasDismissedWelcome, setHasDismissedWelcome] = useState(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSavingTourState, setIsSavingTourState] = useState(false);
  const [interactionComplete, setInteractionComplete] = useState(false);

  // Reset interactionComplete when step changes.
  useEffect(() => {
    setInteractionComplete(false);
  }, [currentStepIndex]);

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
    setInteractionComplete(false);
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
    setInteractionComplete(false);
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
    navigate("/catalog");
    await persistOnboardingCompletion();
  }, [navigate, persistOnboardingCompletion]);

  const handleTourNext = useCallback(async () => {
    // Block advance on interactive steps until the interaction is done.
    const step = TOUR_STEPS[currentStepIndex];
    if (step?.interactive && !interactionComplete) return;

    // After adding a friend, invalidate schedule data so the next step
    // shows John Doe's courses immediately.
    if (step?.id === "friends-add-friend") {
      void queryClient.invalidateQueries({ queryKey: ["schedule", "friends"] });
    }

    if (currentStepIndex >= TOUR_STEPS.length - 1) {
      setIsTourOpen(false);
      setCurrentStepIndex(0);
      navigate("/catalog");
      await persistOnboardingCompletion();
      return;
    }

    setCurrentStepIndex((current) => Math.min(current + 1, TOUR_STEPS.length - 1));
  }, [currentStepIndex, interactionComplete, navigate, persistOnboardingCompletion, queryClient]);

  const handleInteractionComplete = useCallback(() => {
    setInteractionComplete(true);
  }, []);

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
            interactionComplete={interactionComplete}
            onInteractionComplete={handleInteractionComplete}
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
