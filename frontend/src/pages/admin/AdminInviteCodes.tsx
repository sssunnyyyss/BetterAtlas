import { FormEvent, useEffect, useState } from "react";
import { api } from "../../api/client.js";

type InviteCode = {
  id: number;
  code: string;
  badgeSlug: string;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  createdAt: string | null;
};

function formatDateTime(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

export default function AdminInviteCodes() {
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [code, setCode] = useState("");
  const [badgeSlug, setBadgeSlug] = useState("early-adopter");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  async function loadInviteCodes() {
    const data = await api.get<InviteCode[]>("/admin/invite-codes");
    setInviteCodes(data);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setMessage("");
    try {
      await api.post<InviteCode>("/admin/invite-codes", {
        code,
        badgeSlug,
        maxUses: maxUses ? Number.parseInt(maxUses, 10) : null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      setCode("");
      setMaxUses("");
      setExpiresAt("");
      setMessage("Invite code created.");
      await loadInviteCodes();
    } catch (err: any) {
      setMessage(err.message || "Failed to create invite code");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setMessage("");
    try {
      await api.delete(`/admin/invite-codes/${id}`);
      setMessage("Invite code deleted.");
      await loadInviteCodes();
    } catch (err: any) {
      setMessage(err.message || "Failed to delete invite code");
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadInviteCodes();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return <div className="text-sm text-gray-600">Loading invite codes...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Create Invite Code</h2>
        <form onSubmit={handleCreate} className="grid md:grid-cols-2 gap-3">
          <input
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="BETA-2026"
            className="rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
          />
          <input
            type="text"
            required
            value={badgeSlug}
            onChange={(e) => setBadgeSlug(e.target.value)}
            placeholder="Badge slug"
            className="rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
          />
          <input
            type="number"
            min={1}
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder="Max uses (optional)"
            className="rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
          />
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
          />
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-black disabled:opacity-50"
            >
              {isSaving ? "Creating..." : "Create Invite Code"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900">Existing Invite Codes</h2>
        {message && <p className="text-sm text-gray-600">{message}</p>}

        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-3">Code</th>
                <th className="py-2 pr-3">Badge</th>
                <th className="py-2 pr-3">Usage</th>
                <th className="py-2 pr-3">Expires</th>
                <th className="py-2 pr-3">Created</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {inviteCodes.map((inviteCode) => (
                <tr key={inviteCode.id} className="border-b border-gray-100">
                  <td className="py-2 pr-3 font-medium text-gray-900">{inviteCode.code}</td>
                  <td className="py-2 pr-3 text-gray-700">{inviteCode.badgeSlug}</td>
                  <td className="py-2 pr-3 text-gray-700">
                    {inviteCode.usedCount}
                    {inviteCode.maxUses ? ` / ${inviteCode.maxUses}` : " / ∞"}
                  </td>
                  <td className="py-2 pr-3 text-gray-700">{formatDateTime(inviteCode.expiresAt)}</td>
                  <td className="py-2 pr-3 text-gray-700">{formatDateTime(inviteCode.createdAt)}</td>
                  <td className="py-2 pr-3">
                    <button
                      type="button"
                      onClick={() => handleDelete(inviteCode.id)}
                      className="px-2 py-1 rounded text-xs border border-red-300 text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {inviteCodes.length === 0 && (
                <tr>
                  <td className="py-3 text-gray-500" colSpan={6}>
                    No invite codes yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
