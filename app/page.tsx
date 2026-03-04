import { createClient } from "@/lib/supabase/server";
import { listEvents, getEventDateTime } from "@/lib/calendar";
import { CALENDARS, type CalendarEvent, type Profile } from "@/lib/types";
import EventsClient from "@/components/EventsClient";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function groupByMonth(
  events: CalendarEvent[]
): Record<string, { label: string; events: CalendarEvent[] }> {
  const groups: Record<string, { label: string; events: CalendarEvent[] }> = {};
  for (const ev of events) {
    const dt = getEventDateTime(ev);
    if (!dt) continue;
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    const label = dt.toLocaleString("en-US", { month: "long", year: "numeric" });
    if (!groups[key]) groups[key] = { label, events: [] };
    groups[key].events.push(ev);
  }
  return groups;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ cal?: string }>;
}) {
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

  const sp = await searchParams;
  const calKey = sp.cal && CALENDARS[sp.cal] ? sp.cal : "mobile";
  const calInfo = CALENDARS[calKey];

  let events: CalendarEvent[] = [];
  let fetchError = "";
  try {
    events = await listEvents(calInfo.id);
  } catch (e: unknown) {
    fetchError =
      e instanceof Error ? e.message : "Failed to load events.";
  }

  events.sort((a, b) => {
    const da = getEventDateTime(a)?.getTime() ?? 0;
    const db = getEventDateTime(b)?.getTime() ?? 0;
    return da - db;
  });

  const monthGroups = groupByMonth(events);
  const monthKeys = Object.keys(monthGroups).sort();

  return (
    <EventsClient
      events={events}
      monthGroups={monthGroups}
      monthKeys={monthKeys}
      calKey={calKey}
      calendars={CALENDARS}
      profile={profile as Profile}
      fetchError={fetchError}
    />
  );
}
