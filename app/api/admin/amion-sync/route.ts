import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCalendarService } from "@/lib/calendar";
import { CALENDARS } from "@/lib/types";
import {
  fetchMcucResidents,
  formatAmionEntry,
  getEventDateKey,
  type AmionResident,
} from "@/lib/amion";

export const dynamic = "force-dynamic";

interface SyncResult {
  event_id: string;
  event_title: string;
  event_date: string;
  residents_added: string[];
  residents_skipped: string[];
}

export async function POST(req: NextRequest) {
  // Auth check — admin only
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse request body
  let month: string;
  let year: string;
  try {
    const body = await req.json();
    month = String(body.month ?? "").padStart(2, "0");
    year = String(body.year ?? "");
    if (!month || !year || month === "00" || year.length !== 4) {
      throw new Error("Invalid month/year");
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body. Provide { month, year }." }, { status: 400 });
  }

  // 1. Fetch Amion MCUC data for the given month/year
  let mcucByDate: Map<string, AmionResident[]>;
  try {
    mcucByDate = await fetchMcucResidents(month, year);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch Amion data.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (mcucByDate.size === 0) {
    return NextResponse.json({
      message: "No MCUC assignments found in Amion for this month.",
      results: [],
      total_added: 0,
      total_skipped: 0,
    });
  }

  // 2. Fetch all Mobile Clinic Google Calendar events for the month
  const calInfo = CALENDARS["mobile"];
  const service = await getCalendarService();

  // Build time range for the requested month
  const timeMin = new Date(`${year}-${month}-01T00:00:00`).toISOString();
  const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate(); // 0th day of next month = last day of this month
  const timeMax = new Date(`${year}-${month}-${String(lastDay).padStart(2, "0")}T23:59:59`).toISOString();

  let calEvents: { id: string; summary: string; description?: string; start: { dateTime?: string; date?: string } }[] = [];
  try {
    const res = await service.events.list({
      calendarId: calInfo.id,
      singleEvents: true,
      orderBy: "startTime",
      timeMin,
      timeMax,
      maxResults: 250,
    });
    calEvents = (res.data.items ?? []) as typeof calEvents;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch calendar events.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // 3. For each calendar event, match MCUC residents by date and update
  const results: SyncResult[] = [];
  let totalAdded = 0;
  let totalSkipped = 0;

  for (const ev of calEvents) {
    const startRaw = ev.start?.dateTime ?? ev.start?.date;
    const dateKey = getEventDateKey(startRaw);
    if (!dateKey) continue;

    const residents = mcucByDate.get(dateKey);
    if (!residents || residents.length === 0) continue;

    const result: SyncResult = {
      event_id: ev.id,
      event_title: ev.summary ?? "(untitled)",
      event_date: dateKey,
      residents_added: [],
      residents_skipped: [],
    };

    const currentDesc = (ev.description ?? "").replace(/<br>/gi, "\n");

    // Split existing description into Amion blocks, manual signup blocks, and generic text
    const parts = currentDesc.split("\n\n").map((p) => p.trim()).filter(Boolean);
    const amionBlocks: string[] = [];
    const manualSignupBlocks: string[] = [];
    const genericBlocks: string[] = [];

    for (const p of parts) {
      if (p.startsWith("Signed up by:") && p.includes("[Amion]")) {
        amionBlocks.push(p);
      } else if (p.startsWith("Signed up by:")) {
        manualSignupBlocks.push(p);
      } else {
        genericBlocks.push(p);
      }
    }

    // Determine which residents to add vs skip
    for (const resident of residents) {
      const marker = `Signed up by: ${resident.name} [Amion]`;
      if (currentDesc.includes(marker)) {
        result.residents_skipped.push(resident.name);
        totalSkipped++;
      } else {
        const entry = formatAmionEntry(resident);
        amionBlocks.push(entry);
        result.residents_added.push(resident.name);
        totalAdded++;
      }
    }

    // Only update if we actually added something
    if (result.residents_added.length === 0) {
      results.push(result);
      continue;
    }

    // Rebuild description: generic text → Amion blocks → manual signups
    const newDescParts = [
      ...genericBlocks,
      ...amionBlocks,
      ...manualSignupBlocks,
    ];
    const newDescription = newDescParts.join("\n\n");

    try {
      await service.events.patch({
        calendarId: calInfo.id,
        eventId: ev.id,
        requestBody: { description: newDescription },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      result.residents_added = [];
      result.residents_skipped = [...result.residents_skipped, ...result.residents_added];
      result.event_title = `${result.event_title} [ERROR: ${msg}]`;
      totalAdded -= result.residents_added.length;
      totalSkipped += result.residents_added.length;
    }

    results.push(result);
  }

  // Only return events that had matching MCUC residents
  const relevantResults = results.filter(
    (r) => r.residents_added.length > 0 || r.residents_skipped.length > 0
  );

  return NextResponse.json({
    message: `Sync complete. ${totalAdded} assignment(s) added, ${totalSkipped} already present.`,
    total_added: totalAdded,
    total_skipped: totalSkipped,
    results: relevantResults,
  });
}
