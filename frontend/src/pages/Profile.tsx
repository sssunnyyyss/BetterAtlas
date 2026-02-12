import { useState } from "react";
import { useAuth } from "../lib/auth.js";
import { api } from "../api/client.js";
import type { User } from "@betteratlas/shared";

export default function Profile() {
  const { user, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [graduationYear, setGraduationYear] = useState(
    user?.graduationYear?.toString() || ""
  );
  const [major, setMajor] = useState(user?.major || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      await api.patch<User>("/users/me", {
        displayName,
        graduationYear: graduationYear ? parseInt(graduationYear) : undefined,
        major: major || undefined,
      });
      setMessage("Profile updated");
      setEditing(false);
    } catch (err: any) {
      setMessage(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto p-6">
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
            Display Name
          </label>
          {editing ? (
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
            />
          ) : (
            <p className="text-gray-900">{user.displayName}</p>
          )}
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
            <button
              onClick={() => setEditing(true)}
              className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700"
            >
              Edit Profile
            </button>
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
    </div>
  );
}
