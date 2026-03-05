/**
 * app/api/ics/[eventId]/route.ts
 *
 * Returns a .ics calendar file for a single event.
 * Auth-required — user must be logged in.
 * Usage: GET /api/ics/<eventId>?cal=mobile|sports
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEvent } from "@/lib/calendar";
import { CALENDARS } from "@/lib/types";

export const dynamic = "force-dynamic";

// ─── helpers ────────────────────────────────────────────────────────────────

/** Format a Date to iCalendar UTC timestamp: 20260305T160000Z */
function toICSDateTime(iso: string): string {
  const d = new Date(iso);
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** Format an all-day date string (YYYY-MM-DD) to iCalendar DATE: 20260305 */
function toICSDate(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

/** Fold long lines per RFC 5545 (max 75 octets, continuation starts with a space) */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let pos = 0;
  while (pos < line.length) {
    if (pos === 0) {
      chunks.push(line.slice(0, 75));
      pos = 75;
    } else {
      chunks.push(" " + line.slice(pos, pos + 74));
      pos += 74;
    }
  }
  return chunks.join("\r\n");
}

/** Escape special characters per RFC 5545 */
function icsEscape(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Strip signup blocks from description — only keep generic text */
function cleanDescription(desc: string): string {
  const normalized = desc.replace(/<br\s*\/?>/gi, "\n");
  const parts = normalized.split("\n\n").map((p) => p.trim()).filter(Boolean);
  return parts
    .filter((p) => !p.startsWith("Signed up by:"))
    .join("\n\n")
    .trim();
}

/** Generate a stable UID from eventId + calKey */
function makeUID(eventId: string, calKey: string): string {
  return `${eventId}-${calKey}@samc-events`;
}

// ─── route handler ───────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;

  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const calKey = searchParams.get("cal") ?? "mobile";
  const calInfo = CALENDARS[calKey] ?? CALENDARS["mobile"];

  // Fetch the event from Google Calendar
  let event: Awaited<ReturnType<typeof getEvent>>;
  try {
    event = await getEvent(calInfo.id, eventId);
  } catch {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const title = event.summary ?? "SAMC Event";
  const location = event.location ?? "";
  const rawDesc = event.description ?? "";
  const description = cleanDescription(rawDesc);
  const uid = makeUID(eventId, calKey);

  // Build DTSTART / DTEND lines
  let dtStart: string;
  let dtEnd: string;

  if (event.start?.dateTime) {
    // Timed event — convert to UTC
    dtStart = `DTSTART:${toICSDateTime(event.start.dateTime)}`;
    dtEnd = `DTEND:${toICSDateTime(event.end?.dateTime ?? event.start.dateTime)}`;
  } else if (event.start?.date) {
    // All-day event
    dtStart = `DTSTART;VALUE=DATE:${toICSDate(event.start.date)}`;
    const endDate = event.end?.date ?? event.start.date;
    dtEnd = `DTEND;VALUE=DATE:${toICSDate(endDate)}`;
  } else {
    return NextResponse.json({ error: "Event has no start date." }, { status: 400 });
  }

  // Build .ics content
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SAMC GME Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    dtStart,
    dtEnd,
    foldLine(`SUMMARY:${icsEscape(title)}`),
    ...(location ? [foldLine(`LOCATION:${icsEscape(location)}`)] : []),
    ...(description ? [foldLine(`DESCRIPTION:${icsEscape(description)}`)] : []),
    `DTSTAMP:${toICSDateTime(new Date().toISOString())}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  const icsContent = lines.join("\r\n");

  // Safe filename from event title
  const safeTitle = title.replace(/[^a-z0-9\s-]/gi, "").replace(/\s+/g, "-").toLowerCase();
  const filename = `${safeTitle || "event"}.ics`;

  return new NextResponse(icsContent, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
