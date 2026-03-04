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
  const body = await req.json().catch(() => ({}));
  const targetFullName: string | undefined = body.target_full_name;

  const event = await getEvent(calInfo.id, eventId);
  const existing = event.description ?? "";
  const normalized = existing.replace(/<br>/g, "\n");
  const parts = normalized.split("\n\n");

  const signupMarker = "Signed up by:";
  let filtered: string[];

  if (profile.is_admin) {
    if (targetFullName) {
      const tmarker = `Signed up by: ${targetFullName}`;
      filtered = parts.filter((p) => !p.includes(tmarker));
    } else {
      filtered = parts.filter((p) => !p.trim().startsWith(signupMarker));
    }
  } else {
    const userMarker = `Signed up by: ${profile.full_name}`;
    const hasSignup = parts.some((p) => p.includes(userMarker));
    if (!hasSignup) {
      return NextResponse.json(
        { error: "No signup found to cancel." },
        { status: 400 }
      );
    }
    filtered = parts.filter((p) => !p.includes(userMarker));
  }

  event.description = filtered.join("\n\n");
  const updated = await updateEvent(calInfo.id, eventId, event);
  return NextResponse.json({ event: updated });
}
