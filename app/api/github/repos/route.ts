import { NextRequest, NextResponse } from "next/server";
import { assertSupabaseUser } from "@/lib/auth";
import { getGithubTokenForUser } from "@/lib/github-token";
import {
  fetchGithubUserRepos,
  fetchRepoByFullName,
  type GithubApiRepository,
} from "@/lib/github";
import { standardResponse } from "@/lib/response";
import type { GithubRepo } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const user = await assertSupabaseUser(request);
    const githubToken = await getGithubTokenForUser(user.id);
    const fullName = request.nextUrl.searchParams.get("full_name");

    if (fullName) {
      const repo = await fetchRepoByFullName(githubToken, fullName);
      return NextResponse.json(standardResponse(true, mapRepo(repo), 200));
    }

  const repos = await fetchGithubUserRepos(githubToken);
  const payload = repos.map(mapRepo);

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

function mapRepo(repo: GithubApiRepository): GithubRepo {
  return {
    id: repo.id,
    name: repo.name,
    html_url: repo.html_url,
    description: repo.description,
    private: repo.private,
    fork: repo.fork,
    language: repo.language,
    stargazers_count: repo.stargazers_count ?? 0,
    watchers_count: repo.watchers_count ?? 0,
    forks_count: repo.forks_count ?? 0,
    owner: repo.owner?.login,
    created_at: repo.created_at,
    updated_at: repo.updated_at,
    pushed_at: repo.pushed_at,
    default_branch: repo.default_branch,
    open_issues_count: repo.open_issues_count,
    visibility: repo.visibility,
  };
}
