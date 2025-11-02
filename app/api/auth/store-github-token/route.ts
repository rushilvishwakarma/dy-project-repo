import { NextRequest, NextResponse } from "next/server";
import { assertSupabaseUser } from "@/lib/auth";
import { fetchGithubUser } from "@/lib/github";
import { standardResponse } from "@/lib/response";
import { adminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const payloadSchema = z.object({
  provider_token: z.string().min(1, "provider_token is required"),
  access_token: z.string().optional(),
  refresh_token: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await assertSupabaseUser(request);
    const payload = await request.json();
    const { provider_token } = payloadSchema.parse(payload);

    const githubProfile = await fetchGithubUser(provider_token);

    const record = {
      user_id: user.id,
      github_token: provider_token,
      github_id: githubProfile.id,
      username: githubProfile.login,
      email: githubProfile.email,
      avatar_url: githubProfile.avatar_url,
      profile_url: githubProfile.html_url,
      updated_at: new Date().toISOString(),
    };

    const { error } = await adminClient
      .from("user_tokens")
      .upsert(record, { onConflict: "user_id" });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(
      standardResponse(true, { message: "GitHub token stored" }, 200)
    );
  } catch (error) {
    const status =
      error instanceof Error && "status" in error && typeof (error as { status: unknown }).status === "number"
        ? (error as { status: number }).status
        : 500;
    return NextResponse.json(
      standardResponse(false, undefined, status, (error as Error).message),
      { status }
    );
  }
}
