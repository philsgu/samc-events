import { createClient } from "@/lib/supabase/server";
import { listEvents, getEventDateTime } from "@/lib/calendar";
import { CALENDARS, type CalendarEvent, type Profile } from "@/lib/types";
import { redirect } from "next/navigation";
import AddToCalendarButton from "@/components/AddToCalendarButton";

export const dynamic = "force-dynamic";

interface SignedUpEntry {
  calKey: string;
  calLabel: string;
  event: CalendarEvent;
  startDisplay: string;
  isPast: boolean;
}

function formatEventDate(isoStr?: string): string {
  if (!isoStr) return "";
  return new Date(isoStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  });
}

function formatEventTime(isoStr?: string): string {
  if (!isoStr) return "";
  return new Date(isoStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Los_Angeles",
    timeZoneName: "short",
  });
}

export default async function SignedUpPage() {
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
  const p = profile as Profile;

  const marker = `Signed up by: ${p.full_name}`;

  // Fetch both calendars in parallel
  const results = await Promise.allSettled(
    Object.entries(CALENDARS).map(async ([calKey, calInfo]) => {
      const events = await listEvents(calInfo.id);
      return { calKey, calInfo, events };
    })
  );

  const entries: SignedUpEntry[] = [];
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const { calKey, calInfo, events } = result.value;
    for (const ev of events) {
      if (ev.description?.includes(marker)) {
        const dt = getEventDateTime(ev);
        const startRaw = ev.start?.dateTime ?? ev.start?.date;
        entries.push({
          calKey,
          calLabel: calInfo.short_label,
          event: ev,
          startDisplay: startRaw
            ? `${formatEventDate(startRaw)} ${formatEventTime(startRaw)}`
            : "Unknown time",
          isPast: dt ? dt <= new Date() : false,
        });
      }
    }
  }

  // Sort chronologically
  entries.sort((a, b) => {
    const da = getEventDateTime(a.event)?.getTime() ?? 0;
    const db = getEventDateTime(b.event)?.getTime() ?? 0;
    return da - db;
  });

  const upcoming = entries.filter((e) => !e.isPast);
  const past = entries.filter((e) => e.isPast);

  return (
    <div className="page-container">
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.25rem" }}>
        My Signed-Up Events
      </h1>
      <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
        Showing registrations across both calendars for{" "}
        <strong>{p.full_name}</strong>.
      </p>

      {entries.length === 0 && (
        <div className="wide-card" style={{ textAlign: "center", color: "var(--text-secondary)" }}>
          <p style={{ margin: 0 }}>You are not signed up for any upcoming events.</p>
          <a href="/" className="btn btn-primary" style={{ marginTop: "1rem" }}>
            Browse Events
          </a>
        </div>
      )}

      {upcoming.length > 0 && (
        <section style={{ marginBottom: "2rem" }}>
          <h2
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-secondary)",
              borderBottom: "2px solid var(--border)",
              paddingBottom: "0.5rem",
              marginBottom: "0.75rem",
            }}
          >
            Upcoming ({upcoming.length})
          </h2>
          <div className="event-group">
            {upcoming.map((entry) => (
              <SignupCard key={`${entry.calKey}-${entry.event.id}`} entry={entry} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-secondary)",
              borderBottom: "2px solid var(--border)",
              paddingBottom: "0.5rem",
              marginBottom: "0.75rem",
            }}
          >
            Past ({past.length})
          </h2>
          <div className="event-group">
            {past.map((entry) => (
              <SignupCard key={`${entry.calKey}-${entry.event.id}`} entry={entry} past />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SignupCard({
  entry,
  past = false,
}: {
  entry: SignedUpEntry;
  past?: boolean;
}) {
  const { event, calLabel, calKey, startDisplay } = entry;
  return (
    <div
      className="event-card"
      style={{ opacity: past ? 0.7 : 1 }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
        <h3 className="event-title" style={{ margin: 0 }}>
          {event.summary}
        </h3>
        <span
          className={`badge ${calKey === "mobile" ? "badge-primary" : "badge-success"}`}
          style={{ flexShrink: 0 }}
        >
          {calLabel}
        </span>
      </div>
      <div className="event-meta">
        <div className="event-meta-row">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {startDisplay}
        </div>
        {event.location && (
          <div className="event-meta-row">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="event-location-link"
            >
              {event.location}
            </a>
          </div>
        )}
      </div>
      {past && (
        <span className="text-muted" style={{ fontSize: "0.78rem" }}>
          Event has passed
        </span>
      )}
      {!past && (
        <div className="event-actions">
          <a
            href={`/?cal=${calKey}`}
            className="btn btn-outline btn-sm"
          >
            View Calendar
          </a>
          <AddToCalendarButton
            eventId={event.id ?? ""}
            calKey={calKey}
            eventTitle={event.summary ?? "event"}
          />
        </div>
      )}
    </div>
  );
}
