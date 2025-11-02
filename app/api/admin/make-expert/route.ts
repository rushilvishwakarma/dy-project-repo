import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const bodySchema = z.object({
  user_id: z.string().uuid().optional(),
  // fallback: allow passing plain id string too
  id: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = bodySchema.parse(payload);
    const userId = parsed.user_id ?? parsed.id;

    if (!userId) {
      return NextResponse.json({ success: false, error: "user_id is required" }, { status: 400 });
    }

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
