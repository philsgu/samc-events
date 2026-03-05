/**
 * app/api/admin/send-reminders/route.ts
 *
 * Vercel Cron endpoint — runs daily at 8:00 AM Pacific (16:00 UTC).
 * Scans both Google Calendars for events happening TOMORROW (America/Los_Angeles).
 * For each event, finds manual (non-Amion) signups in the description and sends
 * a reminder email via Resend to each registered user.
 *
 * Protected by Authorization: Bearer <CRON_SECRET> header.
 * Vercel sets this header automatically on cron invocations.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCalendarService, toPST } from "@/lib/calendar";
import { CALENDARS } from "@/lib/types";
import { sendReminderEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Returns tomorrow's date string "YYYY-MM-DD" in America/Los_Angeles timezone.
 */
function getTomorrowDateKey(): string {
  const now = new Date();
  // Advance by 1 day
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return tomorrow.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

/**
 * Returns the date portion of a Google Calendar event start as "YYYY-MM-DD"
 * in America/Los_Angeles timezone.
 */
function eventDateKey(start: { dateTime?: string; date?: string } | undefined): string | null {
  const raw = start?.dateTime ?? start?.date;
  if (!raw) return null;
  try {
    return new Date(raw).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  } catch {
    return null;
  }
}

/**
 * Formats a Google Calendar event's start/end into a human-readable time range,
 * or returns null for all-day events.
 * e.g. "8:00 AM – 12:00 PM"
 */
function formatTimeRange(
  start: { dateTime?: string; date?: string } | undefined,
  end: { dateTime?: string; date?: string } | undefined
): string | null {
  if (!start?.dateTime) return null; // all-day
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  const s = fmt(start.dateTime);
  const e = end?.dateTime ? fmt(end.dateTime) : null;
  return e ? `${s} – ${e}` : s;
}

/**
 * Formats a date key "YYYY-MM-DD" into a human-readable display string.
 * e.g. "Wednesday, March 5, 2026"
 */
function formatDateDisplay(dateKey: string): string {
  // Parse as local noon to avoid timezone boundary issues
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  return dt.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

interface SignupEntry {
  name: string;
  email: string;
}

/**
 * Parses an event description and returns all MANUAL (non-Amion) signup entries.
 *
 * Description blocks look like:
 *   Signed up by: Kim, P
 *   Kim, P <phillip.kim@samc.com> (PGY3 - FM) - 6195551234
 *
 * Amion blocks have "[Amion]" on the first line and are skipped.
 */
function parseManualSignups(description: string): SignupEntry[] {
  const signups: SignupEntry[] = [];
  // Normalize <br> tags inserted by Google Calendar
  const text = description.replace(/<br\s*\/?>/gi, "\n");
  const lines = text.split("\n").map((l) => l.trim());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("Signed up by:")) continue;
    // Skip Amion entries
    if (line.includes("[Amion]")) continue;

    // The next non-empty line contains: "Name <email> (specialty) - phone"
    let detailLine = "";
    for (let j = i + 1; j < lines.length && j <= i + 2; j++) {
      if (lines[j]) { detailLine = lines[j]; break; }
    }

    // Extract email from angle brackets
    const emailMatch = detailLine.match(/<([^>]+@[^>]+)>/);
    if (!emailMatch) continue;
    const email = emailMatch[1].trim();

    // Extract name — everything before the first " <"
    const nameMatch = detailLine.match(/^([^<]+)</);;
    const name = nameMatch ? nameMatch[1].trim() : line.replace("Signed up by:", "").trim();

    if (email) signups.push({ name, email });
  }

  return signups;
}

// ─── route handler ───────────────────────────────────────────────────────────

interface ReminderResult {
  calendar: string;
  event_id: string;
  event_title: string;
  event_date: string;
  emails_sent: string[];
  emails_failed: { email: string; error: string }[];
}

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tomorrowKey = getTomorrowDateKey();

  // Build a ±1 second window around tomorrow for the calendar query
  const [y, m, d] = tomorrowKey.split("-").map(Number);
  const timeMin = new Date(y, m - 1, d, 0, 0, 0).toISOString();
  const timeMax = new Date(y, m - 1, d, 23, 59, 59).toISOString();

  const service = await getCalendarService();
  const results: ReminderResult[] = [];
  let totalSent = 0;
  let totalFailed = 0;

  for (const [calKey, calInfo] of Object.entries(CALENDARS)) {
    let calEvents: {
      id: string;
      summary?: string;
      description?: string;
      location?: string;
      start: { dateTime?: string; date?: string };
      end: { dateTime?: string; date?: string };
    }[] = [];

    try {
      const res = await service.events.list({
        calendarId: calInfo.id,
        singleEvents: true,
        orderBy: "startTime",
        timeMin,
        timeMax,
        maxResults: 50,
      });
      calEvents = (res.data.items ?? []) as typeof calEvents;
    } catch (err) {
      console.error(`[send-reminders] Failed to fetch ${calKey} calendar:`, err);
      continue;
    }

    for (const ev of calEvents) {
      const dateKey = eventDateKey(ev.start);
      if (dateKey !== tomorrowKey) continue;
      if (!ev.description) continue;

      const signups = parseManualSignups(ev.description);
      if (signups.length === 0) continue;

      const result: ReminderResult = {
        calendar: calInfo.short_label,
        event_id: ev.id,
        event_title: ev.summary ?? "(untitled)",
        event_date: dateKey,
        emails_sent: [],
        emails_failed: [],
      };

      const dateDisplay = formatDateDisplay(dateKey);
      const timeDisplay = formatTimeRange(ev.start, ev.end);

      // Deduplicate emails within this event
      const seen = new Set<string>();
      for (const signup of signups) {
        const emailLower = signup.email.toLowerCase();
        if (seen.has(emailLower)) continue;
        seen.add(emailLower);

        try {
          await sendReminderEmail({
            to: signup.email,
            recipientName: signup.name,
            eventTitle: ev.summary ?? "(untitled)",
            eventDateDisplay: dateDisplay,
            eventTimeDisplay: timeDisplay,
            eventLocation: ev.location ?? null,
            calendarLabel: calInfo.label,
          });
          result.emails_sent.push(signup.email);
          totalSent++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          result.emails_failed.push({ email: signup.email, error: msg });
          totalFailed++;
          console.error(`[send-reminders] Failed to send to ${signup.email}:`, err);
        }
      }

      results.push(result);
    }
  }

  console.log(`[send-reminders] ${tomorrowKey}: sent=${totalSent} failed=${totalFailed}`);

  return NextResponse.json({
    message: `Reminders sent for ${tomorrowKey}. Sent: ${totalSent}, Failed: ${totalFailed}.`,
    tomorrow: tomorrowKey,
    total_sent: totalSent,
    total_failed: totalFailed,
    results,
  });
}
