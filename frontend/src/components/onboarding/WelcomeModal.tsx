import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Badge } from "@betteratlas/shared";
import BadgeReveal from "./BadgeReveal.js";

interface WelcomeModalProps {
  isOpen: boolean;
  badges?: Badge[];
  onTakeTour: () => void;
  onSkipForNow: () => void;
}

const FEATURES = [
  { icon: "\u2728", label: "AI-powered recommendations" },
  { icon: "\u2B50", label: "Honest ratings & reviews" },
  { icon: "\uD83D\uDD0D", label: "Intent-aware search" },
  { icon: "\uD83D\uDCC5", label: "Visual schedule builder" },
  { icon: "\uD83D\uDC65", label: "Friends & wishlists" },
  { icon: "\uD83C\uDF93", label: "Degree tracking" },
];

export default function WelcomeModal({
  isOpen,
  badges,
  onTakeTour,
  onSkipForNow,
}: WelcomeModalProps) {
  const [step, setStep] = useState(0);
  const [entered, setEntered] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setEntered(true));
      });
      requestAnimationFrame(() => dialogRef.current?.focus());
    } else {
      setEntered(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onSkipForNow();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onSkipForNow]);

  const earlyAdopter = useMemo(
    () => (badges ?? []).find((b) => b.slug === "early-adopter") ?? null,
    [badges],
  );

  if (!isOpen) return null;

  const totalSteps = 4;
  const progress = ((step + 1) / totalSteps) * 100;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 transition-colors duration-500 sm:p-5 md:p-8 ${
        entered ? "bg-black/60 backdrop-blur-sm" : "bg-black/0"
      }`}
      role="presentation"
      onMouseDown={onSkipForNow}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to BetterAtlas"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className={`relative flex h-full max-h-[820px] w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl outline-none transition-all duration-700 ease-out sm:rounded-3xl ${
          entered
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-6 scale-[0.97] opacity-0"
        }`}
      >
        {/* Decorative gradient orbs */}
        <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-primary-100/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-emerald-100/40 blur-3xl" />

        {/* Progress bar */}
        <div className="relative z-10 h-1 w-full bg-gray-100">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-emerald-400 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Skip button */}
        <button
          type="button"
          onClick={onSkipForNow}
          className="absolute right-4 top-4 z-10 rounded-full px-3 py-1.5 text-sm text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 sm:right-6 sm:top-5"
        >
          Skip
        </button>

        {/* Step content */}
        <div
          className="relative z-10 flex flex-1 items-center justify-center overflow-hidden px-6 py-8 sm:px-12"
          aria-live="polite"
        >
          <div key={step} className="ob-step-enter w-full max-w-lg text-center">
            {step === 0 && <StepWelcome />}
            {step === 1 && <StepBadge badge={earlyAdopter} />}
            {step === 2 && <StepFeatures />}
            {step === 3 && <StepReady />}
          </div>
        </div>

        {/* Bottom navigation */}
        <div className="relative z-10 flex items-center justify-between border-t border-gray-100 px-6 py-4 sm:px-8 sm:py-5">
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSteps }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStep(i)}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  i === step
                    ? "w-8 bg-primary-600"
                    : i < step
                      ? "w-2.5 bg-primary-300"
                      : "w-2.5 bg-gray-200"
                }`}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(s - 1, 0))}
                className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(s + 1, 3))}
                className="rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-600/25 transition-all hover:bg-primary-700 hover:shadow-primary-700/30"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={onTakeTour}
                className="ob-cta-glow rounded-xl bg-gradient-to-r from-primary-600 to-emerald-500 px-8 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:shadow-xl"
              >
                Take the tour &rarr;
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── Step sub-components ── */

function StepWelcome() {
  return (
    <div className="space-y-6">
      <div className="ob-float mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-50 to-emerald-50 text-4xl shadow-sm">
        🎓
      </div>
      <div className="space-y-3">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Welcome to BetterAtlas
        </h2>
        <p className="mx-auto max-w-md text-base text-gray-500 sm:text-lg">
          You&rsquo;re one of the first. Your feedback directly shapes how course
          planning at Emory improves from here.
        </p>
      </div>
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
        Beta Access
      </div>
    </div>
  );
}

function StepBadge({ badge }: { badge: Badge | null }) {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-5xl">
        You&rsquo;ve earned this
      </h2>
      <div className="ob-badge-enter">
        <BadgeReveal badge={badge} />
      </div>
      <p className="mx-auto max-w-sm text-base text-gray-500">
        This badge shows next to your name on reviews, your profile, and friend
        lists across the app.
      </p>
    </div>
  );
}

function StepFeatures() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          What you&rsquo;re getting
        </h2>
        <p className="text-base text-gray-500 sm:text-lg">
          Everything you need to plan smarter.
        </p>
      </div>
      <div className="mx-auto grid max-w-md gap-3 sm:grid-cols-2">
        {FEATURES.map((f, i) => (
          <div
            key={f.label}
            className="ob-feature-card flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 text-left transition-colors hover:bg-gray-100"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <span className="text-xl">{f.icon}</span>
            <span className="text-sm font-medium text-gray-700">{f.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepReady() {
  return (
    <div className="space-y-6">
      <div className="ob-float mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-50 to-violet-50 text-4xl shadow-sm">
        🗺️
      </div>
      <div className="space-y-3">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Ready for the tour?
        </h2>
        <p className="mx-auto max-w-md text-base text-gray-500 sm:text-lg">
          Six quick stops to show you everything. Takes about a minute.
        </p>
      </div>
    </div>
  );
}
