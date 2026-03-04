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

  // Query profiles directly — avoids cookie-forwarding issues with internal fetch
  const { data: usersData } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  const users: Profile[] = usersData ?? [];

  return <AdminClient users={users} currentUserId={user.id} />;
}
