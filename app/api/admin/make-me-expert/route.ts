import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { assertSupabaseUser } from "@/lib/auth";

export async function POST() {
  try {
    // get the currently authenticated user from the Authorization header
    const user = await assertSupabaseUser();
    const userId = user.id;

    const { error } = await adminClient.from("profiles").update({ role: "expert" }).eq("id", userId);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `User ${userId} set to expert` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
