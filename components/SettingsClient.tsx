"use client";

import { useState } from "react";
import { SPECIALTIES, type Profile } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

function phoneFormat(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function pwStrength(pw: string): { score: number; label: string; cls: string } {
  if (!pw) return { score: 0, label: "", cls: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score: 20, label: "Very weak", cls: "very-weak" };
  if (score === 2) return { score: 40, label: "Weak", cls: "weak" };
  if (score === 3) return { score: 60, label: "Good", cls: "good" };
  return { score: 80 + (score - 4) * 20, label: "Strong", cls: "strong" };
}

interface Props {
  profile: Profile;
}

export default function SettingsClient({ profile }: Props) {
  // Profile form state
  const [fullName, setFullName] = useState(profile.full_name);
  const [cellNumber, setCellNumber] = useState(profile.cell_number);
  const [specialty, setSpecialty] = useState(profile.specialty);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Password form state
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const strength = pwStrength(newPw);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      setProfileMsg({ text: "Name is required.", type: "error" });
      return;
    }
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          cell_number: cellNumber.trim(),
          specialty,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setProfileMsg({ text: json.error ?? "Failed to save.", type: "error" });
      } else {
        setProfileMsg({ text: "Profile updated successfully.", type: "success" });
      }
    } catch {
      setProfileMsg({ text: "Network error. Please try again.", type: "error" });
    }
    setProfileSaving(false);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw.length < 8) {
      setPwMsg({ text: "Password must be at least 8 characters.", type: "error" });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ text: "Passwords do not match.", type: "error" });
      return;
    }
    setPwSaving(true);
    setPwMsg(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) {
        setPwMsg({ text: error.message, type: "error" });
      } else {
        setPwMsg({ text: "Password updated successfully.", type: "success" });
        setNewPw("");
        setConfirmPw("");
      }
    } catch {
      setPwMsg({ text: "Network error. Please try again.", type: "error" });
    }
    setPwSaving(false);
  }

  return (
    <div className="page-container">
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.25rem" }}>Settings</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "2rem" }}>
        {profile.email}
      </p>

      <div className="settings-layout">
        {/* Profile card */}
        <div className="settings-card">
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginTop: 0, marginBottom: "1.25rem" }}>
            Profile Information
          </h2>
          <form onSubmit={saveProfile}>
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Cell Phone</label>
              <input
                type="tel"
                value={cellNumber}
                onChange={(e) => setCellNumber(phoneFormat(e.target.value))}
                placeholder="(619) 555-1234"
              />
            </div>
            <div className="form-group">
              <label>Specialty</label>
              <select
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
              >
                {SPECIALTIES.map((sp) => (
                  <option key={sp.value} value={sp.value}>
                    {sp.label}
                  </option>
                ))}
              </select>
            </div>

            {profileMsg && (
              <div className={`alert ${profileMsg.type === "error" ? "alert-error" : "alert-success"}`} style={{ marginBottom: "1rem" }}>
                {profileMsg.text}
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={profileSaving}>
              {profileSaving ? <span className="spinner" /> : null}
              Save Changes
            </button>
          </form>
        </div>

        {/* Password card */}
        <div className="settings-card">
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginTop: 0, marginBottom: "1.25rem" }}>
            Change Password
          </h2>
          <form onSubmit={changePassword}>
            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
              />
              {newPw && (
                <div className="pw-meter">
                  <div className="pw-meter-bar-track">
                    <div
                      className={`pw-meter-bar ${strength.cls}`}
                      style={{ width: `${strength.score}%` }}
                    />
                  </div>
                  <div className="pw-meter-label">{strength.label}</div>
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
            </div>

            {pwMsg && (
              <div className={`alert ${pwMsg.type === "error" ? "alert-error" : "alert-success"}`} style={{ marginBottom: "1rem" }}>
                {pwMsg.text}
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={pwSaving}>
              {pwSaving ? <span className="spinner" /> : null}
              Update Password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
