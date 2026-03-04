import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>, selfId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return !!profile?.is_admin;
}

// POST /api/admin/users/[userId]/toggle-admin
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = await requireAdmin(supabase, user.id);
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (userId === user.id) return NextResponse.json({ error: "Cannot change your own admin status." }, { status: 400 });

  const { data: target } = await supabase.from("profiles").select("is_admin").eq("id", userId).single();
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const { error } = await supabase
    .from("profiles")
    .update({ is_admin: !target.is_admin })
    .eq("id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, is_admin: !target.is_admin });
}
