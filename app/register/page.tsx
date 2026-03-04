"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SPECIALTIES } from "@/lib/types";

function digitsOnly(s: string) {
  return s.replace(/\D+/g, "");
}
function formatUSPhone(d: string): string {
  if (d.startsWith("1") && d.length > 1) d = d.slice(1);
  if (d.length === 0) return "";
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
}
function isValidUSPhone(raw: string) {
  const d = digitsOnly(raw);
  return d.length === 10 || (d.length === 11 && d.startsWith("1"));
}
function passwordStrength(pw: string): string {
  if (!pw) return "Password is required.";
  if (pw.length < 12) return "Password must be at least 12 characters.";
  if (!/[a-z]/.test(pw)) return "Password must include a lowercase letter.";
  if (!/[A-Z]/.test(pw)) return "Password must include an uppercase letter.";
  if (!/[0-9]/.test(pw)) return "Password must include a number.";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Password must include a symbol.";
  return "";
}
function pwScore(pw: string): number {
  let s = 0;
  if (pw.length >= 12) s += 2; else if (pw.length >= 8) s += 1;
  if (/[a-z]/.test(pw)) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [cellNumber, setCellNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState("");
  const [loading, setLoading] = useState(false);
  const [meterScore, setMeterScore] = useState(0);

  useEffect(() => { setMeterScore(pwScore(password)); }, [password]);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = "Full name is required.";
    if (!cellNumber.trim()) e.cellNumber = "Cell number is required.";
    else if (!isValidUSPhone(cellNumber)) e.cellNumber = "Enter a valid US phone, e.g. (555) 555-5555.";
    if (!email.trim()) e.email = "Email is required.";
    else if (!/^\S+@\S+\.\S+$/.test(email)) e.email = "Enter a valid email address.";
    const pwErr = passwordStrength(password);
    if (pwErr) e.password = pwErr;
    if (!password2) e.password2 = "Please confirm your password.";
    else if (password && password !== password2) e.password2 = "Passwords do not match.";
    if (!specialty) e.specialty = "Please pick a specialty.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError("");
    if (!validate()) return;
    setLoading(true);

    // Format phone
    let d = digitsOnly(cellNumber);
    if (d.startsWith("1") && d.length === 11) d = d.slice(1);
    const formatted = `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6,10)}`;

    const supabase = createClient();
    const { data: authData, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });

    if (signUpErr) {
      setLoading(false);
      setGlobalError(signUpErr.message);
      return;
    }

    const userId = authData.user?.id;
    if (userId) {
      const { error: profileErr } = await supabase.from("profiles").insert({
        id: userId,
        full_name: fullName,
        cell_number: formatted,
        email,
        specialty,
        is_admin: false,
      });
      if (profileErr) {
        setLoading(false);
        setGlobalError("Account created but profile save failed: " + profileErr.message);
        return;
      }
    }

    setLoading(false);
    router.push("/login?registered=1");
  }

  const meterPct = Math.min(100, (meterScore / 6) * 100);
  const meterClass = meterPct >= 80 ? "strong" : meterPct >= 60 ? "good" : meterPct >= 40 ? "weak" : "very-weak";
  const meterLabel = meterPct >= 80 ? "Strong" : meterPct >= 60 ? "Good" : meterPct >= 40 ? "Weak" : meterPct > 0 ? "Very Weak" : "—";

  const isValid = !fullName.trim() || !cellNumber.trim() || !email.trim() ||
    !!passwordStrength(password) || !password2 || password !== password2 || !specialty;

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Create Account</h1>
          <p>Join SAMC GME FM Events</p>
        </div>

        {globalError && (
          <div className="alert alert-error" role="alert">
            <span>{globalError}</span>
            <button className="alert-close" onClick={() => setGlobalError("")}>×</button>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="full_name">Full Name</label>
            <input
              id="full_name"
              required
              placeholder="Enter your full name"
              value={fullName}
              className={errors.fullName ? "input-error" : ""}
              onChange={(e) => setFullName(e.target.value)}
              onBlur={validate}
            />
            <div className="error-text">{errors.fullName}</div>
          </div>

          <div className="form-group">
            <label htmlFor="cell_number">Cell Number</label>
            <input
              id="cell_number"
              required
              placeholder="(555) 555-5555"
              inputMode="numeric"
              maxLength={14}
              value={cellNumber}
              className={errors.cellNumber ? "input-error" : ""}
              onChange={(e) => {
                let d = digitsOnly(e.target.value);
                if (d.length > 10) d = d.slice(0, 10);
                setCellNumber(formatUSPhone(d));
              }}
              onBlur={validate}
            />
            <div className="error-text">{errors.cellNumber}</div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              required
              placeholder="Enter your email"
              value={email}
              className={errors.email ? "input-error" : ""}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={validate}
            />
            <div className="error-text">{errors.email}</div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              placeholder="Create a password"
              value={password}
              className={errors.password ? "input-error" : ""}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={validate}
            />
            <div className="error-text">{errors.password}</div>
            <div className="help-text">
              At least 12 characters with uppercase, lowercase, number, and symbol.
            </div>
            <div className="pw-meter">
              <div className="pw-meter-bar-track">
                <div
                  className={`pw-meter-bar ${meterClass}`}
                  style={{ width: `${meterPct}%` }}
                />
              </div>
              <div className="pw-meter-label">Strength: {meterLabel}</div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password2">Confirm Password</label>
            <input
              id="password2"
              type="password"
              required
              placeholder="Confirm your password"
              value={password2}
              className={errors.password2 ? "input-error" : ""}
              onChange={(e) => setPassword2(e.target.value)}
              onBlur={validate}
            />
            <div className="error-text">{errors.password2}</div>
          </div>

          <div className="form-group">
            <label htmlFor="specialty">Specialty</label>
            <select
              id="specialty"
              required
              value={specialty}
              className={errors.specialty ? "input-error" : ""}
              onChange={(e) => setSpecialty(e.target.value)}
              onBlur={validate}
            >
              <option value="">Select your specialty</option>
              {SPECIALTIES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <div className="error-text">{errors.specialty}</div>
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading || isValid}>
            {loading ? <span className="spinner" /> : null}
            Create Account
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: 0 }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "var(--primary)", fontWeight: 500 }}>
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
