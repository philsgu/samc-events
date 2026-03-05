/**
 * app/api/admin/send-reminders/route.ts
 *
 * Vercel Cron endpoint — runs daily at 8:00 AM Pacific (16:00 UTC).
 * Scans both Google Calendars for events happening TOMORROW (America/Los_Angeles).
 * For each event, finds manual (non-Amion) signups in the description and sends
 * a reminder email via Resend to each registered user.
 *
 * After each run a row is written to public.cron_logs so the admin dashboard
 * can display the last run status.
 *
 * Protected by Authorization: Bearer <CRON_SECRET> header.
 * Vercel sets this header automatically on cron invocations.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCalendarService } from "@/lib/calendar";
import { CALENDARS } from "@/lib/types";
import { sendReminderEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// ─── helpers ────────────────────────────────────────────────────────────────

function getTomorrowDateKey(): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return tomorrow.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

function eventDateKey(start: { dateTime?: string; date?: string } | undefined): string | null {
  const raw = start?.dateTime ?? start?.date;
  if (!raw) return null;
  try {
    return new Date(raw).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  } catch {
    return null;
  }
}

function formatTimeRange(
  start: { dateTime?: string; date?: string } | undefined,
  end: { dateTime?: string; date?: string } | undefined
): string | null {
  if (!start?.dateTime) return null;
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

function formatDateDisplay(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  return dt.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

interface SignupEntry {
  name: string;
  email: string;
}

function parseManualSignups(description: string): SignupEntry[] {
  const signups: SignupEntry[] = [];
  const text = description.replace(/<br\s*\/?>/gi, "\n");
  const lines = text.split("\n").map((l) => l.trim());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("Signed up by:")) continue;
    if (line.includes("[Amion]")) continue;

    let detailLine = "";
    for (let j = i + 1; j < lines.length && j <= i + 2; j++) {
      if (lines[j]) { detailLine = lines[j]; break; }
    }

    const emailMatch = detailLine.match(/<([^>]+@[^>]+)>/);
    if (!emailMatch) continue;
    const email = emailMatch[1].trim();

    const nameMatch = detailLine.match(/^([^<]+)</);
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

  // Service-role Supabase client for writing cron_logs (bypasses RLS)
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const tomorrowKey = getTomorrowDateKey();
  const [y, m, d] = tomorrowKey.split("-").map(Number);
  const timeMin = new Date(y, m - 1, d, 0, 0, 0).toISOString();
  const timeMax = new Date(y, m - 1, d, 23, 59, 59).toISOString();

  const results: ReminderResult[] = [];
  let totalSent = 0;
  let totalFailed = 0;
  let fatalError: string | null = null;

  try {
    const service = await getCalendarService();

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
  } catch (err) {
    fatalError = err instanceof Error ? err.message : "Unexpected error during reminder run.";
    console.error("[send-reminders] Fatal error:", err);
  }

  // ── Write result to cron_logs ────────────────────────────────────────────
  const summary = fatalError
    ? `Fatal error: ${fatalError}`
    : totalSent === 0 && totalFailed === 0
    ? `No events with manual signups found for ${tomorrowKey}.`
    : `${totalSent} sent, ${totalFailed} failed for ${tomorrowKey}.`;

  const { error: logError } = await serviceSupabase.from("cron_logs").insert({
    job: "send-reminders",
    success: !fatalError && totalFailed === 0,
    total_sent: totalSent,
    total_failed: totalFailed,
    summary,
    details: results,
  });

  if (logError) {
    console.error("[send-reminders] Failed to write cron_log:", logError.message);
  }

  console.log(`[send-reminders] ${tomorrowKey}: sent=${totalSent} failed=${totalFailed}`);

  if (fatalError) {
    return NextResponse.json({ error: fatalError }, { status: 500 });
  }

  return NextResponse.json({
    message: summary,
    tomorrow: tomorrowKey,
    total_sent: totalSent,
    total_failed: totalFailed,
    results,
  });
}
