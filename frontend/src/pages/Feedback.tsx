import { useState, type FormEvent } from "react";
import { useSubmitFeedback } from "../hooks/useFeedback.js";
import type { CreateFeedbackInput, FeedbackCategory } from "@betteratlas/shared";

const CATEGORY_OPTIONS: Array<{ value: FeedbackCategory; label: string }> = [
  { value: "general", label: "General Feedback" },
  { value: "feature_request", label: "Feature Request" },
  { value: "bug_report", label: "Bug Report" },
];

export default function Feedback() {
  const submitFeedback = useSubmitFeedback();
  const [category, setCategory] = useState<FeedbackCategory>("general");
  const [message, setMessage] = useState("");
  const [pagePath, setPagePath] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSuccessMessage("");

    const payload: CreateFeedbackInput = {
      category,
      message,
      ...(pagePath.trim() ? { pagePath: pagePath.trim() } : {}),
    };

    try {
      await submitFeedback.mutateAsync(payload);
      setMessage("");
      setPagePath("");
      setSuccessMessage("Thanks. Your feedback was submitted.");
    } catch {
      // Error is shown via mutation state below.
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900">Feedback</h1>
      <p className="mt-2 text-sm text-gray-600">
        Share bugs, ideas, and beta feedback. For incorrect course data, use the 3-dot menu on a course detail page.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-6 bg-white rounded-lg border border-gray-200 p-6 space-y-4"
      >
        <div>
          <label htmlFor="feedback-category" className="block text-sm font-medium text-gray-700">
            Category
          </label>
          <select
            id="feedback-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
            className="mt-1 w-full rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="feedback-page-path" className="block text-sm font-medium text-gray-700">
            Optional page/path
          </label>
          <input
            id="feedback-page-path"
            type="text"
            value={pagePath}
            onChange={(e) => setPagePath(e.target.value)}
            placeholder="/catalog/123?semester=Spring%202026"
            className="mt-1 w-full rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
          />
        </div>

        <div>
          <label htmlFor="feedback-message" className="block text-sm font-medium text-gray-700">
            Details
          </label>
          <textarea
            id="feedback-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            minLength={10}
            maxLength={4000}
            rows={7}
            placeholder="What happened, what you expected, and any useful context for us."
            className="mt-1 w-full rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
          />
          <div className="mt-1 text-xs text-gray-500">{message.length}/4000</div>
        </div>

        {submitFeedback.isError && (
          <p className="text-sm text-red-600">
            {(submitFeedback.error as any)?.message || "Failed to submit feedback"}
          </p>
        )}
        {successMessage && (
          <p className="text-sm text-primary-700">{successMessage}</p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitFeedback.isPending}
            className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {submitFeedback.isPending ? "Submitting..." : "Submit Feedback"}
          </button>
        </div>
      </form>
    </div>
  );
}
