import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { type Profile } from "@/lib/types";
import AdminClient from "@/components/AdminClient";

export const dynamic = "force-dynamic";

export interface CronLog {
  id: number;
  job: string;
  ran_at: string;
  success: boolean;
  total_sent: number;
  total_failed: number;
  summary: string | null;
}

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

  // Fetch the latest cron_logs row for the send-reminders job
  const { data: logData } = await supabase
    .from("cron_logs")
    .select("id, job, ran_at, success, total_sent, total_failed, summary")
    .eq("job", "send-reminders")
    .order("ran_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastReminderRun: CronLog | null = logData ?? null;

  return <AdminClient users={users} currentUserId={user.id} lastReminderRun={lastReminderRun} />;
}
