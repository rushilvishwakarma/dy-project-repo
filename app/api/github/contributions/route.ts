import { NextRequest, NextResponse } from "next/server";
import { assertSupabaseUser } from "@/lib/auth";
import { getGithubTokenForUser } from "@/lib/github-token";
import {
  fetchGithubContributions,
  type GithubContributionWeekApi,
} from "@/lib/github";
import { standardResponse } from "@/lib/response";

export async function GET(request: NextRequest) {
  try {
    const user = await assertSupabaseUser(request);
    const githubToken = await getGithubTokenForUser(user.id);
    const data = await fetchGithubContributions(githubToken);

    const calendar =
      data.data?.viewer?.contributionsCollection?.contributionCalendar ?? null;

    const contributions =
      calendar?.weeks?.flatMap((week: GithubContributionWeekApi) =>
        week.contributionDays.map((day) => ({
          date: day.date,
          count: day.contributionCount,
        }))
      ) ?? [];

    const payload = {
      total_contributions: calendar?.totalContributions ?? 0,
      contributions,
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
