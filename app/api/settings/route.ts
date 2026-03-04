import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { full_name, email, cell_number, specialty } = body;

  if (!full_name?.trim()) return NextResponse.json({ error: "Full name is required." }, { status: 400 });
  if (!email?.trim() || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Valid email is required." }, { status: 400 });

  // Check email uniqueness if changed
  const { data: existing } = await supabase.from("profiles").select("id").eq("email", email).neq("id", user.id).single();
  if (existing) return NextResponse.json({ error: "Email already in use." }, { status: 400 });

  const { error } = await supabase
    .from("profiles")
    .update({ full_name, email, cell_number, specialty })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
