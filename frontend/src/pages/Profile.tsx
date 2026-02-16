import { useCallback, useState } from "react";
import { useAuth } from "../lib/auth.js";
import { api } from "../api/client.js";
import type { User, UserReview } from "@betteratlas/shared";
import { Link } from "react-router-dom";
import { useMyReviews, useUpdateReview, useDeleteReview } from "../hooks/useReviews.js";
import { useCourseDetail } from "../hooks/useCourses.js";
import ReviewCard from "../components/review/ReviewCard.js";
import EditReviewModal from "../components/review/EditReviewModal.js";
import UserBadge from "../components/ui/UserBadge.js";
import { useOnboarding } from "../components/onboarding/OnboardingProvider.js";

type ProgramsSyncStats = {
  fetchedPrograms: number;
  upsertedPrograms: number;
  updatedRequirements: number;
  skippedUnchanged: number;
  errors: Array<{ sourceUrl: string; error: string }>;
};

export default function Profile() {
  const { user, logout, refresh } = useAuth();
  const { restartTour } = useOnboarding();
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(user?.username || "");
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [graduationYear, setGraduationYear] = useState(
    user?.graduationYear?.toString() || ""
  );
  const [major, setMajor] = useState(user?.major || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isSyncingPrograms, setIsSyncingPrograms] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncStats, setSyncStats] = useState<ProgramsSyncStats | null>(null);
  const { data: myReviews, isLoading: myReviewsLoading } = useMyReviews();
  const deleteReview = useDeleteReview();
  const [editingReview, setEditingReview] = useState<UserReview | null>(null);
  const closeEditModal = useCallback(() => setEditingReview(null), []);
  const updateReview = useUpdateReview(editingReview?.courseId ?? 0);
  const { data: editingCourse } = useCourseDetail(editingReview?.courseId ?? 0);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      await api.patch<User>("/users/me", {
        username,
        fullName,
        graduationYear: graduationYear ? parseInt(graduationYear) : undefined,
        major: major || undefined,
      });
      await refresh();
      setMessage("Profile updated");
      setEditing(false);
    } catch (err: any) {
      setMessage(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleRunProgramsSync() {
    setIsSyncingPrograms(true);
    setSyncMessage("");
    try {
      const stats = await api.post<ProgramsSyncStats>("/admin/programs/sync/me");
      setSyncStats(stats);
      setSyncMessage("Programs sync completed");
    } catch (err: any) {
      setSyncMessage(err.message || "Failed to run programs sync");
    } finally {
      setIsSyncingPrograms(false);
    }
  }

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>

      {message && (
        <div className="bg-primary-50 border border-primary-200 text-primary-700 px-4 py-3 rounded-md mb-4 text-sm">
          {message}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-500">Email</label>
          <p className="text-gray-900">{user.email}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-500">
            Username
          </label>
          {editing ? (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-gray-500 select-none">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
          ) : (
            <p className="text-gray-900">@{user.username}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-500">
            Full Name
          </label>
          {editing ? (
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
            />
          ) : (
            <p className="text-gray-900">{user.fullName}</p>
          )}
          <div className="mt-2" data-tour-id="profile-badge-area">
            <p className="text-xs font-medium text-gray-500">Badges</p>
            {(user.badges?.length ?? 0) > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {(user.badges ?? []).map((badge) => (
                  <UserBadge key={badge.slug} badge={badge} />
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-gray-400">No badges yet</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-500">
              Graduation Year
            </label>
            {editing ? (
              <input
                type="number"
                value={graduationYear}
                onChange={(e) => setGraduationYear(e.target.value)}
                className="mt-1 w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
              />
            ) : (
              <p className="text-gray-900">
                {user.graduationYear || "Not set"}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">
              Major
            </label>
            {editing ? (
              <input
                type="text"
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                className="mt-1 w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
              />
            ) : (
              <p className="text-gray-900">{user.major || "Not set"}</p>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          {editing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 rounded-md text-sm font-medium border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700"
              >
                Edit Profile
              </button>
              <button
                onClick={restartTour}
                className="px-4 py-2 rounded-md text-sm font-medium border border-gray-300 hover:bg-gray-50"
              >
                Restart tour
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-6">
        <button
          onClick={logout}
          className="text-sm text-red-500 hover:text-red-700"
        >
          Sign out
        </button>
      </div>

      {user.isAdmin && (
        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Admin Tools</h2>
            <p className="text-sm text-gray-600 mt-1">
              Trigger a programs sync from Emory catalog data.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRunProgramsSync}
              disabled={isSyncingPrograms}
              className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-black disabled:opacity-50"
            >
              {isSyncingPrograms ? "Running sync..." : "Run Programs Sync"}
            </button>
            {syncMessage && <p className="text-sm text-gray-600">{syncMessage}</p>}
          </div>

          {syncStats && (
            <div className="text-sm text-gray-700 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <p className="text-gray-500">Fetched</p>
                <p className="font-semibold">{syncStats.fetchedPrograms}</p>
              </div>
              <div>
                <p className="text-gray-500">Upserted</p>
                <p className="font-semibold">{syncStats.upsertedPrograms}</p>
              </div>
              <div>
                <p className="text-gray-500">Updated</p>
                <p className="font-semibold">{syncStats.updatedRequirements}</p>
              </div>
              <div>
                <p className="text-gray-500">Unchanged</p>
                <p className="font-semibold">{syncStats.skippedUnchanged}</p>
              </div>
            </div>
          )}

          {syncStats && syncStats.errors.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-medium text-red-700 mb-2">
                Sync completed with {syncStats.errors.length} errors.
              </p>
              <ul className="space-y-1">
                {syncStats.errors.slice(0, 5).map((error, idx) => (
                  <li key={`${error.sourceUrl}-${idx}`} className="text-xs text-red-700 break-words">
                    {error.sourceUrl}: {error.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">My Reviews</h2>

        {myReviewsLoading && (
          <div className="mt-3 text-sm text-gray-500">Loading your reviews...</div>
        )}

        {!myReviewsLoading && (myReviews?.length ?? 0) === 0 && (
          <div className="mt-3 text-sm text-gray-500">
            You have not written any reviews yet.
          </div>
        )}

        <div className="space-y-4 mt-4">
          {(myReviews ?? []).map((r) => (
            <div key={r.id}>
              <div className="flex items-center justify-between mb-2">
                <div className="min-w-0">
                  <Link
                    to={`/catalog/${r.course.id}`}
                    className="text-sm font-medium text-primary-700 hover:underline"
                  >
                    {r.course.code}: {r.course.title}
                  </Link>
                  {r.section?.sectionNumber && (
                    <div className="text-xs text-gray-500">
                      Section {r.section.sectionNumber}
                    </div>
                  )}
                </div>
              </div>

              <ReviewCard
                review={r}
                onEdit={(review) => setEditingReview(review as UserReview)}
                onDelete={(id) =>
                  deleteReview.mutate({
                    reviewId: id,
                    courseId: r.courseId,
                    sectionId: r.sectionId,
                  })
                }
              />
            </div>
          ))}
        </div>
      </div>

      <EditReviewModal
        isOpen={!!editingReview}
        review={editingReview}
        sections={(editingCourse?.sections ?? []).map((s) => ({
          id: s.id,
          sectionNumber: s.sectionNumber,
          semester: s.semester,
          instructorName: s.instructor?.name ?? null,
        }))}
        isLoading={updateReview.isPending}
        error={
          updateReview.isError
            ? ((updateReview.error as any)?.message || "Failed to update review")
            : null
        }
        onClose={closeEditModal}
        onSubmit={(data, prevSectionId) =>
          editingReview
            ? updateReview.mutate(
                { reviewId: editingReview.id, data, prevSectionId },
                { onSuccess: () => closeEditModal() }
              )
            : undefined
        }
      />
    </div>
  );
}
