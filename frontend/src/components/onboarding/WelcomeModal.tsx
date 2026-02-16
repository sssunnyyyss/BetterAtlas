import { useEffect, useMemo, useState } from "react";
import type { Badge } from "@betteratlas/shared";
import Modal from "../ui/Modal.js";
import BadgeReveal from "./BadgeReveal.js";

interface WelcomeModalProps {
  isOpen: boolean;
  badges?: Badge[];
  onTakeTour: () => void;
  onSkipForNow: () => void;
}

export default function WelcomeModal({
  isOpen,
  badges,
  onTakeTour,
  onSkipForNow,
}: WelcomeModalProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (isOpen) setStep(0);
  }, [isOpen]);

  const earlyAdopter = useMemo(
    () => (badges ?? []).find((badge) => badge.slug === "early-adopter") ?? null,
    [badges]
  );

  return (
    <Modal
      isOpen={isOpen}
      title={step === 0 ? "Welcome to BetterAtlas" : "Getting Started"}
      onClose={onSkipForNow}
    >
      {step === 0 && (
        <div className="space-y-4">
          <div className="rounded-xl bg-gradient-to-r from-primary-50 to-emerald-50 p-4">
            <h3 className="text-2xl font-bold text-gray-900">You're one of the first.</h3>
            <p className="mt-2 text-sm text-gray-700">
              Thanks for joining the BetterAtlas beta. Your feedback directly shapes
              how course planning at Emory improves from here.
            </p>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-2xl font-bold text-gray-900">You've earned this.</h3>
          <BadgeReveal badge={earlyAdopter} />
          <p className="text-sm text-gray-600">
            This tag shows next to your name on reviews, your profile, and friend
            lists across the app.
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-2xl font-bold text-gray-900">What you're getting</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              "AI-powered course recommendations",
              "Honest ratings and reviews",
              "Search that understands intent",
              "Visual schedule builder",
              "Friends and shared wishlists",
              "Degree tracking",
            ].map((item) => (
              <div
                key={item}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h3 className="text-2xl font-bold text-gray-900">Ready for the tour?</h3>
          <p className="text-sm text-gray-600">
            We will walk you through the core workflows in six short stops.
          </p>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2, 3].map((idx) => (
            <span
              key={idx}
              className={`h-2 w-2 rounded-full ${
                idx === step ? "bg-primary-600" : "bg-gray-300"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => Math.min(prev + 1, 3))}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              Next
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onTakeTour}
                className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Take the tour
              </button>
              <button
                type="button"
                onClick={onSkipForNow}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Skip for now
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
