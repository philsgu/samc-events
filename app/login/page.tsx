"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Welcome Back</h1>
          <p>Sign in to your account to continue</p>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            <span>{error}</span>
            <button className="alert-close" onClick={() => setError("")}>×</button>
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
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            Sign In
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: 0 }}>
            Don&apos;t have an account?{" "}
            <Link href="/register" style={{ color: "var(--primary)", fontWeight: 500 }}>
              Register here
            </Link>
          </p>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "0.5rem" }}>
            <Link href="/forgot-password" style={{ color: "var(--primary)", fontWeight: 500 }}>
              Forgot your password?
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
