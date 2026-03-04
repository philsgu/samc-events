import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEvent, updateEvent } from "@/lib/calendar";
import { CALENDARS } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const calKey = searchParams.get("cal") ?? "mobile";
  const calInfo = CALENDARS[calKey] ?? CALENDARS["mobile"];

  // Get event and check it's in the future
  const event = await getEvent(calInfo.id, eventId);
  const startRaw = event.start?.dateTime ?? event.start?.date;
  if (startRaw) {
    const eventDt = new Date(startRaw);
    if (eventDt <= new Date()) {
      return NextResponse.json(
        { error: "Cannot sign up for past events." },
        { status: 400 }
      );
    }
  }

  // Check not already signed up
  const marker = `Signed up by: ${profile.full_name}`;
  if (event.description?.includes(marker)) {
    return NextResponse.json(
      { error: "Already signed up for this event." },
      { status: 400 }
    );
  }

  const userInfo = `Signed up by: ${profile.full_name}\n${profile.full_name} <${profile.email}> (${profile.specialty}) - ${profile.cell_number}`;
  const existing = event.description ?? "";
  event.description = existing
    ? existing.replace(/<br>/g, "\n") + "\n\n" + userInfo
    : userInfo;

  const updated = await updateEvent(calInfo.id, eventId, event);
  return NextResponse.json({ event: updated });
}
