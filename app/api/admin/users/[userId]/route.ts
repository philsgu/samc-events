import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { admin: null, userId: null };
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile?.is_admin) return { admin: null, userId: user.id };
  return { admin: profile, userId: user.id };
}

// PATCH /api/admin/users/[userId] — update user
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const supabase = await createClient();
  const { admin } = await requireAdmin(supabase);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { full_name, email, cell_number, specialty } = body;

  const { error } = await supabase
    .from("profiles")
    .update({ full_name, email, cell_number, specialty })
    .eq("id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE /api/admin/users/[userId] — delete user
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const supabase = await createClient();
  const { admin, userId: adminId } = await requireAdmin(supabase);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (userId === adminId) return NextResponse.json({ error: "Cannot delete your own account." }, { status: 400 });

  // Use service role to delete auth user (cascades to profile)
  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { error } = await adminSupabase.auth.admin.deleteUser(userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
