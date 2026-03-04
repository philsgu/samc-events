"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setMessage("If that email is registered, a reset link has been sent.");
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Forgot Password</h1>
          <p>Enter your email and we&apos;ll send a reset link</p>
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
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              required
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            Send Reset Link
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
          <Link href="/login" style={{ color: "var(--primary)", fontSize: "0.875rem", fontWeight: 500 }}>
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
