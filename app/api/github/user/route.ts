import { NextRequest, NextResponse } from "next/server";
import { assertSupabaseUser } from "@/lib/auth";
import { getGithubTokenForUser } from "@/lib/github-token";
import { fetchGithubUser } from "@/lib/github";
import { standardResponse } from "@/lib/response";

export async function GET(request: NextRequest) {
  try {
    const user = await assertSupabaseUser(request);
    const githubToken = await getGithubTokenForUser(user.id);
    const profile = await fetchGithubUser(githubToken);

    const payload = {
      github_id: profile.id,
      username: profile.login,
      email: profile.email,
      avatar_url: profile.avatar_url,
      html_url: profile.html_url,
      updated_at: profile.updated_at,
    };

    return NextResponse.json(standardResponse(true, payload, 200));
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
