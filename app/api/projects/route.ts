import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertSupabaseUser } from "@/lib/auth";
import { getGithubTokenForUser } from "@/lib/github-token";
import { standardResponse } from "@/lib/response";
import { adminClient } from "@/lib/supabase/admin";
import { fetchRepoByFullName } from "@/lib/github";

const importSchema = z.object({
  repository_full_name: z
    .string()
    .min(1)
    .regex(/^[^/]+\/[^/]+$/, "repository_full_name must be owner/repo"),
});

export async function GET(request: NextRequest) {
  try {
    const user = await assertSupabaseUser(request);
    const view = request.nextUrl.searchParams.get("view") ?? "developer";

    if (view === "expert") {
      // First get all projects
      const { data: projectsData, error: projectsError } = await adminClient
        .from("projects")
        .select("*")
        .order("stars", { ascending: false });

      if (projectsError) throw new Error(projectsError.message);

      // Get unique user IDs
      const userIds = [...new Set(projectsData?.map(p => p.user_id).filter(Boolean) ?? [])];

      // Fetch profiles for those users
      const { data: profilesData, error: profilesError } = await adminClient
        .from("profiles")
        .select("id, username, full_name, role, avatar_url")
        .in("id", userIds);

      if (profilesError) throw new Error(profilesError.message);

      // Create a map of profiles by id
      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) ?? []);

      // Attach profiles to projects
      const projectsWithProfiles = projectsData?.map(project => ({
        ...project,
        profiles: profilesMap.get(project.user_id) ?? null
      })) ?? [];

      const data = projectsWithProfiles;

      type ProjectWithProfile = Record<string, unknown> & {
        user_id?: string;
        profiles?: unknown;
      };

      const projects = (data ?? []) as ProjectWithProfile[];

      type GroupedProject = {
        owner_id: string;
        owner: unknown;
        projects: ProjectWithProfile[];
      };

      const grouped = Object.values(
        projects.reduce((acc: Record<string, GroupedProject>, project) => {
          const ownerId = project.user_id ?? "unknown";
          acc[ownerId] = acc[ownerId] || {
            owner_id: ownerId,
            owner: project.profiles,
            projects: [],
          };
          acc[ownerId].projects.push(project);
          return acc;
        }, {})
      );

      return NextResponse.json(standardResponse(true, grouped, 200));
    }

    const { data, error } = await adminClient
      .from("projects")
      .select("*, documents:project_documents(count)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json(standardResponse(true, data ?? [], 200));
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

export async function POST(request: NextRequest) {
  try {
    const user = await assertSupabaseUser(request);
    const body = importSchema.parse(await request.json());
    const githubToken = await getGithubTokenForUser(user.id);
    const repo = await fetchRepoByFullName(
      githubToken,
      body.repository_full_name
    );

    const record = {
      user_id: user.id,
      github_repo_id: repo.id,
      repository_full_name: body.repository_full_name,
      name: repo.name,
      description: repo.description,
      html_url: repo.html_url,
      private: repo.private,
      fork: repo.fork,
      language: repo.language,
      stars: repo.stargazers_count ?? 0,
      forks: repo.forks_count ?? 0,
      watchers: repo.watchers_count ?? 0,
      open_issues: repo.open_issues_count ?? 0,
      visibility: repo.visibility,
      owner_username: repo.owner?.login,
      default_branch: repo.default_branch,
      pushed_at: repo.pushed_at,
      created_at_github: repo.created_at,
      updated_at_github: repo.updated_at,
      last_synced_at: new Date().toISOString(),
    };

    const { data, error } = await adminClient
      .from("projects")
      .upsert(record, { onConflict: "github_repo_id" })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json(standardResponse(true, data, 201), { status: 201 });
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
