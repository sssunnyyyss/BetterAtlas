import { useEffect, useMemo, useState } from "react";
import { SEMESTERS } from "@betteratlas/shared";
import RatingStars from "./RatingStars.js";

interface ReviewFormProps {
  sections: Array<{
    id: number;
    sectionNumber: string | null;
    semester: string;
    instructorName: string | null;
  }>;
  onSubmit: (data: {
    semester: string;
    sectionId: number;
    ratingQuality: number;
    ratingDifficulty: number;
    ratingWorkload: number;
    comment?: string;
    isAnonymous: boolean;
  }) => void;
  isLoading?: boolean;
}

export default function ReviewForm({ sections, onSubmit, isLoading }: ReviewFormProps) {
  const [semester, setSemester] = useState<string>(SEMESTERS[SEMESTERS.length - 1]);
  const [sectionId, setSectionId] = useState<number>(sections[0]?.id ?? 0);
  const [ratingQuality, setRatingQuality] = useState(0);
  const [ratingDifficulty, setRatingDifficulty] = useState(0);
  const [ratingWorkload, setRatingWorkload] = useState(0);
  const [comment, setComment] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);

  const sectionById = useMemo(() => {
    const m = new Map<number, ReviewFormProps["sections"][number]>();
    for (const s of sections) m.set(s.id, s);
    return m;
  }, [sections]);

  const selectedSection = sectionById.get(sectionId) ?? null;

  useEffect(() => {
    // Keep selection stable if still present; otherwise default to first available section.
    if (sections.length === 0) {
      setSectionId(0);
      return;
    }
    if (!sections.some((s) => s.id === sectionId)) {
      setSectionId(sections[0]!.id);
    }
  }, [sections, sectionId]);

  useEffect(() => {
    if (selectedSection?.semester) setSemester(selectedSection.semester);
  }, [selectedSection?.semester]);

  const canSubmit =
    ratingQuality > 0 &&
    ratingDifficulty > 0 &&
    ratingWorkload > 0 &&
    semester &&
    sectionId > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      semester,
      sectionId,
      ratingQuality,
      ratingDifficulty,
      ratingWorkload,
      comment: comment || undefined,
      isAnonymous,
    });
    // Reset form
    setRatingQuality(0);
    setRatingDifficulty(0);
    setRatingWorkload(0);
    setComment("");
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      <h3 className="font-semibold text-gray-900">Write a Review</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Section
        </label>
        <select
          value={String(sectionId || "")}
          onChange={(e) => setSectionId(parseInt(e.target.value, 10) || 0)}
          required
          className="rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
          disabled={sections.length === 0}
        >
          {sections.length === 0 && <option value="">No sections listed</option>}
          {sections.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.sectionNumber ? `Section ${s.sectionNumber}` : "Section"} · {s.semester}
              {s.instructorName ? ` · ${s.instructorName}` : ""}
            </option>
          ))}
        </select>
        {selectedSection?.instructorName && (
          <p className="text-xs text-gray-500 mt-1">
            Professor: {selectedSection.instructorName}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Semester Taken
        </label>
        <select
          value={semester}
          onChange={(e) => setSemester(e.target.value)}
          className="rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
          disabled={!!selectedSection?.semester}
        >
          {SEMESTERS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Professor
          </label>
          <RatingStars value={ratingQuality} onChange={setRatingQuality} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Difficulty
          </label>
          <RatingStars value={ratingDifficulty} onChange={setRatingDifficulty} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Workload
          </label>
          <RatingStars value={ratingWorkload} onChange={setRatingWorkload} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Comment (optional)
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={5000}
          className="w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
          placeholder="Share your experience..."
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="anonymous"
          checked={isAnonymous}
          onChange={(e) => setIsAnonymous(e.target.checked)}
          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        <label htmlFor="anonymous" className="text-sm text-gray-700">
          Post anonymously
        </label>
      </div>

      <button
        type="submit"
        disabled={!canSubmit || isLoading}
        className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? "Submitting..." : "Submit Review"}
      </button>
    </form>
  );
}
