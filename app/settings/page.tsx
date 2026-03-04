import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { type Profile } from "@/lib/types";
import SettingsClient from "@/components/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
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
  if (!profile) redirect("/login");

  return <SettingsClient profile={profile as Profile} />;
}
