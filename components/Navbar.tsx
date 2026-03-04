"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      if (data.user) {
        supabase
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .single()
          .then(({ data: p }) => setProfile(p));
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setProfile(null);
      } else {
        supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single()
          .then(({ data: p }) => setProfile(p));
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Close menu when route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav>
      <div className="nav-container">
        <Link href="/" className="nav-logo">
          SAMC GME FM Events Signup
        </Link>

        <button
          className={`hamburger ${menuOpen ? "open" : ""}`}
          aria-label="Toggle menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>

        <ul className={`nav-menu ${menuOpen ? "open" : ""}`}>
          {user ? (
            <>
              <li>
                <span className="nav-user-email">{profile?.email ?? user.email}</span>
              </li>
              <li>
                <Link href="/settings">Settings</Link>
              </li>
              <li>
                <Link href="/signed-up">Signed Up</Link>
              </li>
              {profile?.is_admin && (
                <li>
                  <Link href="/admin">Admin</Link>
                </li>
              )}
              <li>
                <button onClick={handleLogout}>Log Out</button>
              </li>
            </>
          ) : (
            <>
              <li>
                <Link href="/register">Register</Link>
              </li>
              <li>
                <Link href="/login">Log In</Link>
              </li>
              <li>
                <Link href="/forgot-password">Forgot Password?</Link>
              </li>
            </>
          )}
        </ul>
      </div>
    </nav>
  );
}
