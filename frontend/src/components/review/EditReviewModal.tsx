import { useEffect, useMemo, useState } from "react";
import type { ReviewWithAuthor, UpdateReviewInput } from "@betteratlas/shared";
import Modal from "../ui/Modal.js";
import RatingStars from "./RatingStars.js";

export default function EditReviewModal({
  isOpen,
  review,
  sections,
  isLoading,
  error,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  review: ReviewWithAuthor | null;
  sections: Array<{
    id: number;
    sectionNumber: string | null;
    semester: string;
    instructorName: string | null;
  }>;
  isLoading?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (data: UpdateReviewInput, prevSectionId?: number | null) => void;
}) {
  const sectionById = useMemo(() => {
    const m = new Map<number, (typeof sections)[number]>();
    for (const s of sections) m.set(s.id, s);
    return m;
  }, [sections]);

  const [sectionId, setSectionId] = useState<number>(0);
  const [semester, setSemester] = useState<string>("");
  const [ratingQuality, setRatingQuality] = useState(0);
  const [ratingDifficulty, setRatingDifficulty] = useState(0);
  const [ratingWorkload, setRatingWorkload] = useState(0);
  const [comment, setComment] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);

  useEffect(() => {
    if (!isOpen || !review) return;
    setSectionId(review.sectionId ?? sections[0]?.id ?? 0);
    setSemester(review.semester ?? "");
    setRatingQuality(review.ratingQuality ?? 0);
    setRatingDifficulty(review.ratingDifficulty ?? 0);
    setRatingWorkload(review.ratingWorkload ?? 0);
    setComment(review.comment ?? "");
    setIsAnonymous(review.isAnonymous ?? true);
  }, [isOpen, review, sections]);

  const selectedSection = sectionById.get(sectionId) ?? null;

  useEffect(() => {
    if (!selectedSection?.semester) return;
    setSemester(selectedSection.semester);
  }, [selectedSection?.semester]);

  const canSubmit =
    sectionId > 0 &&
    ratingQuality > 0 &&
    ratingDifficulty > 0 &&
    ratingWorkload > 0 &&
    semester;

  return (
    <Modal
      isOpen={isOpen}
      title="Edit Review"
      onClose={onClose}
    >
      {!review ? null : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            onSubmit(
              {
                semester,
                sectionId,
                ratingQuality,
                ratingDifficulty,
                ratingWorkload,
                comment: comment || undefined,
                isAnonymous,
              },
              review.sectionId ?? null
            );
          }}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Section
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Professor</label>
              <RatingStars value={ratingQuality} onChange={setRatingQuality} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
              <RatingStars value={ratingDifficulty} onChange={setRatingDifficulty} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Workload</label>
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
              placeholder="Update your experience..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="edit-anonymous"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="edit-anonymous" className="text-sm text-gray-700">
              Post anonymously
            </label>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-md text-sm border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || isLoading}
              className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

