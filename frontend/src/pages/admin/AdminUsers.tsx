import { FormEvent, useEffect, useState } from "react";
import { api } from "../../api/client.js";

type AdminUser = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  graduationYear: number | null;
  major: string | null;
  createdAt: string;
  isAdmin: boolean;
};

type BanResult = {
  ok: boolean;
  userId: string;
  banned: boolean;
};

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [major, setMajor] = useState("");
  const [graduationYear, setGraduationYear] = useState("");

  async function loadUsers() {
    const data = await api.get<AdminUser[]>(
      `/admin/users?limit=100&q=${encodeURIComponent(q)}`
    );
    setUsers(data);
  }

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    try {
      await api.post<AdminUser>("/admin/users", {
        email,
        password,
        username,
        fullName,
        major: major || undefined,
        graduationYear: graduationYear ? parseInt(graduationYear, 10) : undefined,
      });
      setEmail("");
      setPassword("");
      setUsername("");
      setFullName("");
      setMajor("");
      setGraduationYear("");
      setMessage("User created.");
      await loadUsers();
    } catch (err: any) {
      setMessage(err.message || "Failed to create user");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm("Delete this user account? This removes auth access immediately.")) {
      return;
    }
    setMessage("");
    try {
      await api.delete<{ ok: boolean; userId: string; profileDeleted: boolean }>(
        `/admin/users/${userId}`
      );
      setMessage("User deleted.");
      await loadUsers();
    } catch (err: any) {
      setMessage(err.message || "Failed to delete user");
    }
  }

  async function handleBanToggle(userId: string, banned: boolean) {
    setMessage("");
    try {
      await api.post<BanResult>(`/admin/users/${userId}/ban`, { banned });
      setMessage(banned ? "User access revoked." : "User access restored.");
    } catch (err: any) {
      setMessage(err.message || "Failed to update user access");
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadUsers();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadUsers();
    }, 250);
    return () => clearTimeout(timeout);
  }, [q]);

  if (isLoading) {
    return <div className="text-sm text-gray-600">Loading users...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Create User</h2>
        <form onSubmit={handleCreateUser} className="grid md:grid-cols-2 gap-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
          />
          <input
            type="password"
            required
            placeholder="Temporary password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
          />
          <input
            type="text"
            required
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
          />
          <input
            type="text"
            required
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
          />
          <input
            type="text"
            placeholder="Major (optional)"
            value={major}
            onChange={(e) => setMajor(e.target.value)}
            className="rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
          />
          <input
            type="number"
            placeholder="Graduation year (optional)"
            value={graduationYear}
            onChange={(e) => setGraduationYear(e.target.value)}
            className="rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
          />
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-black disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-900">Manage Users</h2>
          <input
            type="text"
            placeholder="Search users..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-72 max-w-full rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
          />
        </div>

        {message && <p className="text-sm text-gray-600">{message}</p>}

        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Created</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-gray-100">
                  <td className="py-2 pr-3">
                    <p className="text-gray-900 font-medium">@{user.username}</p>
                    <p className="text-gray-500 text-xs">{user.fullName}</p>
                  </td>
                  <td className="py-2 pr-3 text-gray-700">{user.email}</td>
                  <td className="py-2 pr-3 text-gray-700">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-2 pr-3">
                    {user.isAdmin ? (
                      <span className="px-2 py-1 rounded text-xs bg-primary-100 text-primary-700">
                        Admin
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
                        User
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleBanToggle(user.id, true)}
                        className="px-2 py-1 rounded text-xs border border-amber-300 text-amber-700 hover:bg-amber-50"
                      >
                        Revoke
                      </button>
                      <button
                        onClick={() => handleBanToggle(user.id, false)}
                        className="px-2 py-1 rounded text-xs border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="px-2 py-1 rounded text-xs border border-red-300 text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
