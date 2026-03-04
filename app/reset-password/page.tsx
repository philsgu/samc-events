"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function passwordStrength(pw: string): string {
  if (!pw) return "Password is required.";
  if (pw.length < 12) return "Password must be at least 12 characters.";
  if (!/[a-z]/.test(pw)) return "Password must include a lowercase letter.";
  if (!/[A-Z]/.test(pw)) return "Password must include an uppercase letter.";
  if (!/[0-9]/.test(pw)) return "Password must include a number.";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Password must include a symbol.";
  return "";
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // Supabase sets the session from the URL hash on the client
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // If the token is already in the URL on load, also mark ready
    setReady(true);
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const pwErr = passwordStrength(password);
    if (pwErr) { setError(pwErr); return; }
    if (password !== password2) { setError("Passwords do not match."); return; }
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setMessage("Password reset! Redirecting to login…");
      setTimeout(() => router.push("/login"), 2000);
    }
  }

  if (!ready) return null;

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Reset Password</h1>
          <p>Enter your new password below</p>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            <span>{error}</span>
            <button className="alert-close" onClick={() => setError("")}>×</button>
          </div>
        )}
        {message && (
          <div className="alert alert-success" role="alert">
            <span>{message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password">New Password</label>
            <input
              id="password"
              type="password"
              required
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="help-text">
              At least 12 characters with uppercase, lowercase, number, and symbol.
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="password2">Confirm Password</label>
            <input
              id="password2"
              type="password"
              required
              placeholder="Confirm new password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            Reset Password
          </button>
        </form>
      </div>
    </div>
  );
}
