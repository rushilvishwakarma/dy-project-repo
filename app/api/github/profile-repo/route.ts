import { NextRequest, NextResponse } from "next/server";
import { assertSupabaseUser } from "@/lib/auth";
import { getGithubTokenForUser } from "@/lib/github-token";
import { fetchGithubProfileRepo, fetchGithubUser } from "@/lib/github";
import { standardResponse } from "@/lib/response";

export async function GET(request: NextRequest) {
  try {
    const user = await assertSupabaseUser(request);
    const githubToken = await getGithubTokenForUser(user.id);
    const profile = await fetchGithubUser(githubToken);
    const { repo, readme } = await fetchGithubProfileRepo(githubToken, profile.login);

    const payload = {
      name: repo?.name,
      description: repo?.description,
      stars: repo?.stargazers_count,
      updated_at: repo?.updated_at,
      html_url: repo?.html_url,
      readme_content: readme,
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
