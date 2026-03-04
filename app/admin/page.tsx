import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { type Profile } from "@/lib/types";
import AdminClient from "@/components/AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_admin) {
    redirect("/");
  }

  // Fetch all users via the API route (uses service role key)
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/admin/users`,
    { cache: "no-store" }
  );

  let users: Profile[] = [];
  if (res.ok) {
    const json = await res.json();
    users = json.users ?? [];
  }

  return <AdminClient users={users} currentUserId={user.id} />;
}
