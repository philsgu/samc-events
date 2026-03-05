"use client";

import { useState } from "react";
import { type Profile, SPECIALTIES } from "@/lib/types";
import { type CronLog } from "@/app/admin/page";

interface AdminClientProps {
  users: Profile[];
  currentUserId: string;
  lastReminderRun: CronLog | null;
}

interface EditState {
  open: boolean;
  user: Profile | null;
  full_name: string;
  cell_number: string;
  specialty: string;
  saving: boolean;
  error: string;
}

interface ConfirmState {
  open: boolean;
  action: "delete" | "toggle-admin";
  user: Profile | null;
  loading: boolean;
}

interface AmionSyncResult {
  event_id: string;
  event_title: string;
  event_date: string;
  residents_added: string[];
  residents_skipped: string[];
}

interface AmionSyncState {
  month: string;
  year: string;
  loading: boolean;
  error: string;
  result: { message: string; total_added: number; total_skipped: number; results: AmionSyncResult[] } | null;
}

function phoneFormat(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

const MONTHS = [
  { value: "01", label: "January" }, { value: "02", label: "February" },
  { value: "03", label: "March" },   { value: "04", label: "April" },
  { value: "05", label: "May" },     { value: "06", label: "June" },
  { value: "07", label: "July" },    { value: "08", label: "August" },
  { value: "09", label: "September" },{ value: "10", label: "October" },
  { value: "11", label: "November" },{ value: "12", label: "December" },
];

function getDefaultMonthYear() {
  const now = new Date();
  return {
    month: String(now.getMonth() + 1).padStart(2, "0"),
    year: String(now.getFullYear()),
  };
}

export default function AdminClient({ users: initialUsers, currentUserId, lastReminderRun }: AdminClientProps) {
  const [users, setUsers] = useState<Profile[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const [edit, setEdit] = useState<EditState>({
    open: false, user: null,
    full_name: "", cell_number: "", specialty: "",
    saving: false, error: "",
  });

  const [confirm, setConfirm] = useState<ConfirmState>({
    open: false, action: "delete", user: null, loading: false,
  });

  const defaults = getDefaultMonthYear();
  const [amion, setAmion] = useState<AmionSyncState>({
    month: defaults.month,
    year: defaults.year,
    loading: false,
    error: "",
    result: null,
  });

  async function runAmionSync() {
    setAmion((s) => ({ ...s, loading: true, error: "", result: null }));
    try {
      const res = await fetch("/api/admin/amion-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: amion.month, year: parseInt(amion.year) }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAmion((s) => ({ ...s, loading: false, error: json.error ?? "Sync failed." }));
      } else {
        setAmion((s) => ({ ...s, loading: false, result: json }));
      }
    } catch {
      setAmion((s) => ({ ...s, loading: false, error: "Network error. Please try again." }));
    }
  }

  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  function openEdit(u: Profile) {
    setEdit({
      open: true, user: u,
      full_name: u.full_name,
      cell_number: u.cell_number,
      specialty: u.specialty,
      saving: false, error: "",
    });
    document.body.classList.add("modal-open");
  }

  function closeEdit() {
    setEdit((e) => ({ ...e, open: false }));
    document.body.classList.remove("modal-open");
  }

  async function saveEdit() {
    if (!edit.user) return;
    if (!edit.full_name.trim()) {
      setEdit((e) => ({ ...e, error: "Name is required." }));
      return;
    }
    setEdit((e) => ({ ...e, saving: true, error: "" }));
    try {
      const res = await fetch(`/api/admin/users/${edit.user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: edit.full_name.trim(),
          cell_number: edit.cell_number.trim(),
          specialty: edit.specialty,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setEdit((e) => ({ ...e, saving: false, error: json.error ?? "Failed to save." }));
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === edit.user!.id ? { ...u, ...json.profile } : u))
      );
      showToast("User updated.", "success");
      closeEdit();
    } catch {
      setEdit((e) => ({ ...e, saving: false, error: "Network error." }));
    }
  }

  function openConfirm(action: "delete" | "toggle-admin", u: Profile) {
    setConfirm({ open: true, action, user: u, loading: false });
    document.body.classList.add("modal-open");
  }

  function closeConfirm() {
    setConfirm((c) => ({ ...c, open: false }));
    document.body.classList.remove("modal-open");
  }

  async function doConfirm() {
    if (!confirm.user) return;
    setConfirm((c) => ({ ...c, loading: true }));
    try {
      if (confirm.action === "delete") {
        const res = await fetch(`/api/admin/users/${confirm.user.id}`, { method: "DELETE" });
        if (res.ok) {
          setUsers((prev) => prev.filter((u) => u.id !== confirm.user!.id));
          showToast("User deleted.", "success");
        } else {
          const json = await res.json();
          showToast(json.error ?? "Failed to delete.", "error");
        }
      } else {
        const res = await fetch(`/api/admin/users/${confirm.user.id}/toggle-admin`, {
          method: "POST",
        });
        const json = await res.json();
        if (res.ok) {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === confirm.user!.id ? { ...u, is_admin: json.is_admin } : u
            )
          );
          showToast(
            json.is_admin ? "Admin privileges granted." : "Admin privileges removed.",
            "success"
          );
        } else {
          showToast(json.error ?? "Failed to update.", "error");
        }
      }
    } catch {
      showToast("Network error.", "error");
    }
    setConfirm((c) => ({ ...c, loading: false, open: false }));
    document.body.classList.remove("modal-open");
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.specialty.toLowerCase().includes(q)
    );
  });

  return (
    <div className="page-container">

      {/* ── Amion Sync Panel ── */}
      <div className="settings-card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.25rem" }}>
          Amion Block Schedule Sync
        </h2>
        <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "0 0 1rem" }}>
          Auto-assign MCUC residents from Amion to matching Mobile Clinic calendar events.
        </p>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="form-group" style={{ margin: 0, minWidth: "140px" }}>
            <label style={{ fontSize: "0.8rem" }}>Month</label>
            <select
              value={amion.month}
              onChange={(e) => setAmion((s) => ({ ...s, month: e.target.value, result: null, error: "" }))}
              disabled={amion.loading}
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: "100px" }}>
            <label style={{ fontSize: "0.8rem" }}>Year</label>
            <select
              value={amion.year}
              onChange={(e) => setAmion((s) => ({ ...s, year: e.target.value, result: null, error: "" }))}
              disabled={amion.loading}
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={runAmionSync}
            disabled={amion.loading}
            style={{ marginBottom: "0" }}
          >
            {amion.loading ? <span className="spinner" /> : null}
            {amion.loading ? "Syncing…" : "Sync Amion"}
          </button>
        </div>

        {amion.error && (
          <div className="alert alert-error" style={{ marginTop: "1rem" }}>
            {amion.error}
          </div>
        )}

        {amion.result && (
          <div style={{ marginTop: "1rem" }}>
            <div
              className="alert alert-success"
              style={{ marginBottom: amion.result.results.length > 0 ? "0.75rem" : 0 }}
            >
              {amion.result.message}
            </div>
            {amion.result.results.length > 0 && (
              <div style={{ fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {amion.result.results.map((r) => (
                  <div
                    key={r.event_id}
                    style={{
                      padding: "0.5rem 0.75rem",
                      background: "var(--surface)",
                      borderRadius: "var(--radius)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{r.event_title}</div>
                    <div style={{ color: "var(--text-secondary)" }}>{r.event_date}</div>
                    {r.residents_added.length > 0 && (
                      <div style={{ color: "#065f46", marginTop: "0.2rem" }}>
                        Added: {r.residents_added.join(", ")}
                      </div>
                    )}
                    {r.residents_skipped.length > 0 && (
                      <div style={{ color: "var(--text-muted)", marginTop: "0.1rem" }}>
                        Already present: {r.residents_skipped.join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Email Reminder Status ── */}
      <div className="settings-card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.25rem" }}>
          Email Reminder Status
        </h2>
        <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "0 0 0.75rem" }}>
          Daily cron sends reminders at 8:00 AM Pacific to manually registered users for next-day events.
        </p>

        {!lastReminderRun ? (
          <div style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            fontSize: "0.85rem", color: "var(--text-muted)",
            padding: "0.6rem 0.875rem",
            background: "var(--bg)", borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
          }}>
            <span>—</span>
            <span>No runs recorded yet. The cron will run automatically at 8:00 AM Pacific.</span>
          </div>
        ) : (
          <div style={{
            padding: "0.75rem 1rem",
            borderRadius: "var(--radius)",
            border: `1px solid ${lastReminderRun.success ? "#bbf7d0" : lastReminderRun.total_failed > 0 ? "#fde68a" : "#e2e8f0"}`,
            background: lastReminderRun.success ? "#f0fdf4" : lastReminderRun.total_failed > 0 ? "#fffbeb" : "var(--bg)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {lastReminderRun.success ? (
                  <span style={{ color: "#059669", fontSize: "1rem" }}>✓</span>
                ) : lastReminderRun.total_failed > 0 ? (
                  <span style={{ color: "#d97706", fontSize: "1rem" }}>⚠</span>
                ) : (
                  <span style={{ color: "var(--text-muted)", fontSize: "1rem" }}>—</span>
                )}
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>
                  {lastReminderRun.summary ?? "Run completed."}
                </span>
              </div>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {new Date(lastReminderRun.ran_at).toLocaleString("en-US", {
                  timeZone: "America/Los_Angeles",
                  month: "short", day: "numeric", year: "numeric",
                  hour: "numeric", minute: "2-digit", hour12: true,
                })}
              </span>
            </div>
            {(lastReminderRun.total_sent > 0 || lastReminderRun.total_failed > 0) && (
              <div style={{ marginTop: "0.4rem", fontSize: "0.78rem", color: "var(--text-secondary)", display: "flex", gap: "1rem" }}>
                <span style={{ color: "#059669" }}>
                  {lastReminderRun.total_sent} sent
                </span>
                {lastReminderRun.total_failed > 0 && (
                  <span style={{ color: "#d97706" }}>
                    {lastReminderRun.total_failed} failed
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── User Management Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0 }}>Admin Dashboard</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: "0.25rem 0 0" }}>
            {users.length} total {users.length === 1 ? "user" : "users"}
          </p>
        </div>
        <div style={{ position: "relative" }}>
          <input
            type="search"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "0.45rem 0.875rem",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              fontSize: "0.875rem",
              outline: "none",
              width: "220px",
            }}
          />
        </div>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Specialty</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                  No users found.
                </td>
              </tr>
            )}
            {filtered.map((u) => (
              <tr key={u.id}>
                <td data-label="Name">
                  <span style={{ fontWeight: 500 }}>{u.full_name}</span>
                  {u.id === currentUserId && (
                    <span className="badge badge-primary" style={{ marginLeft: "0.4rem" }}>You</span>
                  )}
                </td>
                <td data-label="Email" style={{ wordBreak: "break-all" }}>{u.email}</td>
                <td data-label="Specialty">
                  <span className="badge">{u.specialty}</span>
                </td>
                <td data-label="Phone">{u.cell_number || "—"}</td>
                <td data-label="Role">
                  {u.is_admin ? (
                    <span className="badge badge-success">Admin</span>
                  ) : (
                    <span className="badge">User</span>
                  )}
                </td>
                <td data-label="Joined" style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                  {new Date(u.created_at).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  })}
                </td>
                <td data-label="Actions">
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => openEdit(u)}
                    >
                      Edit
                    </button>
                    {u.id !== currentUserId && (
                      <>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => openConfirm("toggle-admin", u)}
                        >
                          {u.is_admin ? "Remove Admin" : "Make Admin"}
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => openConfirm("delete", u)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      <div
        className={`modal-overlay ${edit.open ? "open" : ""}`}
        onClick={(e) => { if (e.target === e.currentTarget) closeEdit(); }}
      >
        <div className="modal" style={{ maxWidth: "480px" }}>
          <div className="modal-title">Edit User</div>
          {edit.user && (
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
              {edit.user.email}
            </div>
          )}
          {edit.error && (
            <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
              {edit.error}
            </div>
          )}
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              value={edit.full_name}
              onChange={(e) => setEdit((s) => ({ ...s, full_name: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Cell Phone</label>
            <input
              type="tel"
              value={edit.cell_number}
              onChange={(e) => setEdit((s) => ({ ...s, cell_number: phoneFormat(e.target.value) }))}
              placeholder="(619) 555-1234"
            />
          </div>
          <div className="form-group">
            <label>Specialty</label>
            <select
              value={edit.specialty}
              onChange={(e) => setEdit((s) => ({ ...s, specialty: e.target.value }))}
            >
              {SPECIALTIES.map((sp) => (
                <option key={sp.value} value={sp.value}>{sp.label}</option>
              ))}
            </select>
          </div>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={saveEdit} disabled={edit.saving}>
              {edit.saving ? <span className="spinner" /> : null}
              Save
            </button>
            <button className="btn btn-outline" onClick={closeEdit} disabled={edit.saving}>
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      <div
        className={`modal-overlay ${confirm.open ? "open" : ""}`}
        onClick={(e) => { if (e.target === e.currentTarget) closeConfirm(); }}
      >
        <div className="modal">
          <div className="modal-title">
            {confirm.action === "delete" ? "Delete User" : "Toggle Admin"}
          </div>
          <div className="modal-body">
            {confirm.action === "delete"
              ? `Are you sure you want to permanently delete ${confirm.user?.full_name}? This cannot be undone.`
              : confirm.user?.is_admin
              ? `Remove admin privileges from ${confirm.user?.full_name}?`
              : `Grant admin privileges to ${confirm.user?.full_name}?`}
          </div>
          <div className="modal-actions">
            <button
              className={`btn ${confirm.action === "delete" ? "btn-danger" : "btn-secondary"}`}
              onClick={doConfirm}
              disabled={confirm.loading}
            >
              {confirm.loading ? <span className="spinner" /> : null}
              Confirm
            </button>
            <button className="btn btn-outline" onClick={closeConfirm} disabled={confirm.loading}>
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "1.5rem",
            right: "1.5rem",
            zIndex: 2000,
            padding: "0.75rem 1.25rem",
            borderRadius: "var(--radius)",
            background: toast.type === "success" ? "#065f46" : "#b91c1c",
            color: "#fff",
            fontSize: "0.875rem",
            boxShadow: "var(--shadow-lg)",
            maxWidth: "320px",
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
