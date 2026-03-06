import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listAllEvents, getEventDateTime } from "@/lib/calendar";
import { CALENDARS, type CalendarEvent, type Profile } from "@/lib/types";
import ParticipationClient from "@/components/ParticipationClient";

export const dynamic = "force-dynamic";

// ── Signup block parsing ──────────────────────────────────────────────────────
// Each block looks like:
//   Signed up by: Full Name               (manual)
//   Full Name <email> (SPECIALTY) - cell
//
//   Signed up by: Last, F [Amion]         (Amion)
//   Last, F <email> (PGY# - MCUC) - phone

function parseSignedUpName(block: string): { name: string; isAmion: boolean } | null {
  const firstLine = block.split("\n")[0];
  if (!firstLine.startsWith("Signed up by:")) return null;
  const raw = firstLine.replace("Signed up by:", "").trim();
  const isAmion = raw.includes("[Amion]");
  const name = raw.replace("[Amion]", "").trim();
  return { name, isAmion };
}

function getSignupBlocks(description: string): string[] {
  const normalized = description.replace(/<br>/gi, "\n");
  return normalized
    .split("\n\n")
    .map((p) => p.trim())
    .filter((p) => p.startsWith("Signed up by:"));
}

// ── Types for the participation page ─────────────────────────────────────────

export interface PersonalEvent {
  calendarKey: string;
  calendarLabel: string;
  date: string;   // ISO date string
  time: string;   // formatted time
  title: string;
  location: string;
}

export interface PersonalSummary {
  mobileCount: number;
  sportCount: number;
  sites: { location: string; count: number }[];
  events: PersonalEvent[];
}

export interface AllUsersRow {
  name: string;
  isAmion: boolean;
  mobileCount: number;
  sportCount: number;
  total: number;
}

export interface ParticipationData {
  profile: Profile;
  personal: PersonalSummary;
  allUsers: AllUsersRow[] | null; // null for non-admins
  totalParticipants: number | null;
  fetchError: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(isoStr?: string): string {
  if (!isoStr) return "";
  return new Date(isoStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  });
}

function formatTime(isoStr?: string): string {
  if (!isoStr) return "";
  return new Date(isoStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Los_Angeles",
    timeZoneName: "short",
  });
}

// ── Server component ──────────────────────────────────────────────────────────

export default async function ParticipationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const profile = profileData as Profile;

  let fetchError = "";
  const now = new Date();

  // Fetch all events for both calendars from academic year start
  let mobileEvents: CalendarEvent[] = [];
  let sportEvents: CalendarEvent[] = [];

  try {
    [mobileEvents, sportEvents] = await Promise.all([
      listAllEvents(CALENDARS.mobile.id),
      listAllEvents(CALENDARS.sport.id),
    ]);
  } catch (e: unknown) {
    fetchError = e instanceof Error ? e.message : "Failed to load calendar data.";
  }

  // Filter to events that have already started (start <= now)
  const pastMobile = mobileEvents.filter((ev) => {
    const dt = getEventDateTime(ev);
    return dt && dt <= now;
  });
  const pastSport = sportEvents.filter((ev) => {
    const dt = getEventDateTime(ev);
    return dt && dt <= now;
  });

  // ── Build personal summary ──────────────────────────────────────────────────
  const personalEvents: PersonalEvent[] = [];
  const siteCountMap: Record<string, number> = {};

  function processPersonalEvents(
    events: CalendarEvent[],
    calKey: string,
    calLabel: string,
    userName: string
  ) {
    for (const ev of events) {
      if (!ev.description) continue;
      const blocks = getSignupBlocks(ev.description);
      const isSignedUp = blocks.some((b) => {
        const parsed = parseSignedUpName(b);
        return parsed && !parsed.isAmion && parsed.name === userName;
      });
      if (!isSignedUp) continue;

      const startRaw = ev.start?.dateTime ?? ev.start?.date;
      const location = ev.location?.trim() || "No Location";
      personalEvents.push({
        calendarKey: calKey,
        calendarLabel: calLabel,
        date: startRaw ?? "",
        time: formatTime(startRaw),
        title: ev.summary,
        location,
      });
      siteCountMap[location] = (siteCountMap[location] ?? 0) + 1;
    }
  }

  const userName = profile?.full_name ?? "";
  processPersonalEvents(pastMobile, "mobile", CALENDARS.mobile.short_label, userName);
  processPersonalEvents(pastSport, "sport", CALENDARS.sport.short_label, userName);

  // Sort chronologically
  personalEvents.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return da - db;
  });

  // Format dates for display (do this after sorting)
  const formattedPersonalEvents = personalEvents.map((ev) => ({
    ...ev,
    date: formatDate(ev.date),
  }));

  const mobilePersonalCount = personalEvents.filter((e) => e.calendarKey === "mobile").length;
  const sportPersonalCount = personalEvents.filter((e) => e.calendarKey === "sport").length;

  const sites = Object.entries(siteCountMap)
    .map(([location, count]) => ({ location, count }))
    .sort((a, b) => b.count - a.count);

  const personal: PersonalSummary = {
    mobileCount: mobilePersonalCount,
    sportCount: sportPersonalCount,
    sites,
    events: formattedPersonalEvents,
  };

  // ── Build all-users summary (admin only) ────────────────────────────────────
  let allUsers: AllUsersRow[] | null = null;
  let totalParticipants: number | null = null;

  if (profile?.is_admin) {
    const allUsersMap: Record<string, AllUsersRow> = {};

    function accumulateForCalendar(
      events: CalendarEvent[],
      calKey: "mobile" | "sport"
    ) {
      for (const ev of events) {
        if (!ev.description) continue;
        const blocks = getSignupBlocks(ev.description);
        for (const block of blocks) {
          const parsed = parseSignedUpName(block);
          if (!parsed) continue;
          const key = `${parsed.name}__${parsed.isAmion ? "amion" : "manual"}`;
          if (!allUsersMap[key]) {
            allUsersMap[key] = {
              name: parsed.name,
              isAmion: parsed.isAmion,
              mobileCount: 0,
              sportCount: 0,
              total: 0,
            };
          }
          if (calKey === "mobile") allUsersMap[key].mobileCount += 1;
          else allUsersMap[key].sportCount += 1;
          allUsersMap[key].total += 1;
        }
      }
    }

    accumulateForCalendar(pastMobile, "mobile");
    accumulateForCalendar(pastSport, "sport");

    function extractLastName(row: AllUsersRow): string {
      if (row.isAmion) return row.name.split(",")[0].trim();
      const parts = row.name.trim().split(" ");
      return parts[parts.length - 1];
    }
    allUsers = Object.values(allUsersMap).sort((a, b) =>
      extractLastName(a).localeCompare(extractLastName(b))
    );
    totalParticipants = allUsers.length;
  }

  const data: ParticipationData = {
    profile,
    personal,
    allUsers,
    totalParticipants,
    fetchError,
  };

  return <ParticipationClient data={data} />;
}
