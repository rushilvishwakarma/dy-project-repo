import { NextRequest, NextResponse } from "next/server";
import { assertSupabaseUser } from "@/lib/auth";
import { getGithubTokenForUser } from "@/lib/github-token";
import {
  fetchGithubActivity,
  fetchGithubUser,
  type GithubApiEvent,
} from "@/lib/github";
import { standardResponse } from "@/lib/response";

export async function GET(request: NextRequest) {
  try {
    const user = await assertSupabaseUser(request);
    const githubToken = await getGithubTokenForUser(user.id);
    const profile = await fetchGithubUser(githubToken);
    const events = await fetchGithubActivity(githubToken, profile.login);

  const payload = events.slice(0, 10).map((event: GithubApiEvent) => ({
      id: event.id,
      type: event.type,
      repo: event.repo?.name,
      created_at: event.created_at,
    }));

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
