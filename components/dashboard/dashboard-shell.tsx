"use client";

import { type ComponentType, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FolderGit2,
  GitCompare,
  GitFork,
  LineChart,
  Loader2,
  LogOut,
  RefreshCw,
  Search as SearchIcon,
  Star,
  Eye,
} from "lucide-react";
import { useAuthorizedFetch } from "@/hooks/use-authorized-fetch";
import { parseStandardResponse } from "@/lib/api-client";
import {
  GithubContributionSummary,
  GithubRepo,
  GithubUser,
  Profile,
  Project,
  ExpertProjectGroup,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { ContributionGraph } from "@/components/contribution-graph";
import { ProjectDocumentationSheet } from "@/components/projects/project-documentation-sheet";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface DashboardShellProps {
  profile: Profile | null;
}

export function DashboardShell({ profile }: DashboardShellProps) {
  const authorizedFetch = useAuthorizedFetch();
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);
  const [signingOut, setSigningOut] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const [repoSearch, setRepoSearch] = useState("");

  const githubUserQuery = useQuery<GithubUser>({
    queryKey: ["github-user"],
    queryFn: async () => {
      const response = await authorizedFetch("/api/github/user");
      return parseStandardResponse<GithubUser>(response);
    },
  });

  const projectsQuery = useQuery<Project[]>({
    queryKey: ["projects", "developer"],
    queryFn: async () => {
      const response = await authorizedFetch("/api/projects");
      return parseStandardResponse<Project[]>(response);
    },
  });

  const reposQuery = useQuery<GithubRepo[]>({
    queryKey: ["github-repos"],
    queryFn: async () => {
      const response = await authorizedFetch("/api/github/repos");
      return parseStandardResponse<GithubRepo[]>(response);
    },
  });

  const contributionsQuery = useQuery<GithubContributionSummary>({
    queryKey: ["github-contributions"],
    queryFn: async () => {
      const response = await authorizedFetch("/api/github/contributions");
      return parseStandardResponse<GithubContributionSummary>(response);
    },
  });

  const expertProjectsQuery = useQuery<ExpertProjectGroup[]>({
    queryKey: ["projects", "expert"],
    queryFn: async () => {
      const response = await authorizedFetch("/api/projects?view=expert");
      return parseStandardResponse<ExpertProjectGroup[]>(response);
    },
    enabled: profile?.role === "expert",
  });

  // Auto-refresh expert projects when component mounts with expert role
  useEffect(() => {
    if (profile?.role === "expert") {
      queryClient.invalidateQueries({ queryKey: ["projects", "expert"] });
    }
  }, [profile?.role, queryClient]);

  const totalImportedProjects = projectsQuery.data?.length ?? 0;
  const totalAvailableRepos = reposQuery.data?.length ?? 0;
  const totalContributions = contributionsQuery.data?.total_contributions ?? null;
  const expertGroups = expertProjectsQuery.data ?? [];
  const reviewProjects = expertGroups.reduce((accumulator, group) => accumulator + group.projects.length, 0);
  const contributionsDisplay = totalContributions !== null ? totalContributions.toLocaleString() : "--";
  const contributionGraphData = useMemo(() => {
    const contributionDays = contributionsQuery.data?.contributions ?? [];
    if (!contributionDays.length) {
      return [];
    }

    const counts = contributionDays.map((day) => day.count);
    const maxCount = Math.max(...counts);
    if (maxCount === 0) {
      return contributionDays.map((day) => ({ date: day.date, count: day.count, level: 0 }));
    }

    const quartile = maxCount / 4;

    const mapLevel = (count: number) => {
      if (count === 0) return 0;
      if (count <= quartile) return 1;
      if (count <= quartile * 2) return 2;
      if (count <= quartile * 3) return 3;
      return 4;
    };

    return contributionDays.map((day) => ({
      date: day.date,
      count: day.count,
      level: mapLevel(day.count),
    }));
  }, [contributionsQuery.data?.contributions]);
  const contributionYear = contributionGraphData.length
    ? new Date(contributionGraphData[contributionGraphData.length - 1].date).getFullYear()
    : new Date().getFullYear();
  const reposToDisplay = useMemo(() => {
    const repos = reposQuery.data ?? [];
    if (!repos.length) return [];
    const normalized = repoSearch.trim().toLowerCase();
    const filtered = normalized
      ? repos.filter((repo) => {
          const repoName = repo.name?.toLowerCase() ?? "";
          const repoDescription = repo.description?.toLowerCase() ?? "";
          const repoOwner = typeof repo.owner === "string" ? repo.owner.toLowerCase() : "";
          return (
            repoName.includes(normalized) ||
            repoDescription.includes(normalized) ||
            repoOwner.includes(normalized)
          );
        })
      : repos;
    const sorted = [...filtered].sort((a, b) => {
      const aDate = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bDate = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return bDate - aDate;
    });
    return sorted.slice(0, 5);
  }, [reposQuery.data, repoSearch]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      queryClient.clear();
      window.location.href = "/";
    } catch (error) {
      toast.error((error as Error).message ?? "Unable to sign out");
    } finally {
      setSigningOut(false);
    }
  };

  const handleSwitchAccount = async () => {
    setSwitchingAccount(true);
    try {
      await supabase.auth.signOut();
      queryClient.clear();
      const response = await fetch("/api/auth/login");
      if (!response.ok) {
        throw new Error("Failed to start GitHub login");
      }
      const payload = await response.json();
      if (!payload?.success || !payload?.data?.auth_url) {
        throw new Error(payload?.error ?? "Unexpected login response");
      }
      window.location.href = payload.data.auth_url as string;
    } catch (error) {
      toast.error((error as Error).message ?? "Unable to switch account");
      setSwitchingAccount(false);
    }
  };

  const importProjectMutation = useMutation<Project, Error, string>({
    mutationFn: async (fullName: string) => {
      const response = await authorizedFetch("/api/projects", {
        method: "POST",
        body: JSON.stringify({ repository_full_name: fullName }),
      });
      return parseStandardResponse<Project>(response);
    },
    onSuccess: (project: Project) => {
      toast.success(`Imported ${project.name}`);
      queryClient.invalidateQueries({ queryKey: ["projects", "developer"] });
      queryClient.invalidateQueries({ queryKey: ["projects", "expert"] });
    },
    onError: (err: unknown) => {
      toast.error((err as Error).message);
    },
  });

  const importedRepoIds = useMemo(() => {
    const projects = projectsQuery.data ?? [];
    return new Set(projects.map((project: Project) => project.github_repo_id));
  }, [projectsQuery.data]);


  return (
    <div className="space-y-12">
      <section className="rounded-3xl border border-border/60 bg-card/60 p-8">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {githubUserQuery.isLoading ? (
                <Skeleton className="h-16 w-16 rounded-full" />
              ) : (
                <Avatar className="h-16 w-16">
                  <AvatarImage src={githubUserQuery.data?.avatar_url ?? undefined} alt={githubUserQuery.data?.username} />
                  <AvatarFallback>{githubUserQuery.data?.username?.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              )}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-semibold tracking-tight">
                    {githubUserQuery.data?.username ?? "GitHub User"}
                  </h1>
                  <Badge variant="secondary" className="uppercase">
                    {profile?.role ?? "developer"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {githubUserQuery.data?.html_url ? (
                    <a
                      href={githubUserQuery.data.html_url}
                      className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {githubUserQuery.data.html_url}
                    </a>
                  ) : (
                    "Connect GitHub to start importing projects."
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <AnimatedThemeToggler className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background/80 transition hover:border-primary/60" />
              <Button
                size="sm"
                variant="outline"
                onClick={handleSwitchAccount}
                disabled={switchingAccount || signingOut}
              >
                {switchingAccount ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Redirecting
                  </span>
                ) : (
                  "Switch GitHub Account"
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSignOut}
                disabled={signingOut || switchingAccount}
              >
                {signingOut ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="flex items-center gap-2">
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </span>
                )}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatTile
              icon={FolderGit2}
              title="Imported projects"
              description="Synced from GitHub"
              value={totalImportedProjects.toLocaleString()}
              loading={projectsQuery.isLoading}
            />
            <StatTile
              icon={GitCompare}
              title={profile?.role === "expert" ? "Developers to review" : "Tracked repositories"}
              description={profile?.role === "expert" ? "Awaiting feedback" : "Available to import"}
              value={
                profile?.role === "expert"
                  ? reviewProjects.toLocaleString()
                  : totalAvailableRepos.toLocaleString()
              }
              loading={profile?.role === "expert" ? expertProjectsQuery.isLoading : reposQuery.isLoading}
            />
            <StatTile
              icon={LineChart}
              title="Yearly contributions"
              description="Public activity"
              value={contributionsDisplay}
              loading={contributionsQuery.isLoading}
            />
          </div>

          <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Contribution activity</p>
                <p className="text-xs text-muted-foreground">Last 53 weeks of GitHub history</p>
              </div>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{contributionYear}</span>
            </div>
            {contributionsQuery.isLoading ? (
              <Skeleton className="h-56 w-full rounded-xl" />
            ) : contributionGraphData.length ? (
              <ContributionGraph
                data={contributionGraphData}
                year={contributionYear}
                showLegend
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No contribution data yet.
              </div>
            )}
          </div>
        </div>
      </section>

      {profile?.role === "expert" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Expert review queue</h2>
              <p className="text-sm text-muted-foreground">
                Review developer submissions and leave actionable feedback.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["projects", "expert"] })}
              disabled={expertProjectsQuery.isFetching}
            >
              {expertProjectsQuery.isFetching ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Refreshing
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Refresh queue
                </span>
              )}
            </Button>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/50 p-6">
            {expertProjectsQuery.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : expertGroups.length ? (
              expertGroups.map((group: ExpertProjectGroup) => (
                <div
                  key={group.owner_id}
                  className="space-y-4 rounded-xl border border-border/60 bg-background/90 p-4"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage
                        src={group.owner?.avatar_url ?? undefined}
                        alt={group.owner?.username ?? "Developer avatar"}
                      />
                      <AvatarFallback>
                        {group.owner?.username?.slice(0, 2).toUpperCase() ?? "DV"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <p className="text-base font-semibold">
                        {group.owner?.full_name ?? group.owner?.username ?? "Developer"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {group.owner?.username ? `@${group.owner.username}` : "Unlinked profile"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {group.projects.map((project: Project) => (
                      <ProjectCard key={project.id} project={project} compact profile={profile} />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No developer submissions yet"
                description="Encourage developers to import their GitHub repositories to review them here."
              />
            )}
          </div>
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[2fr,1fr]">
        <Card className="h-full border border-border/60 bg-card/60 shadow-md">
          <CardHeader className="space-y-1">
            <CardTitle>Imported projects</CardTitle>
            <CardDescription>Your curated list synced from GitHub.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {projectsQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : totalImportedProjects ? (
              projectsQuery.data?.map((project: Project) => (
                <ProjectCard key={project.id} project={project} profile={profile} />
              ))
            ) : (
              <EmptyState
                title="No projects imported yet"
                description="Select a repository from your GitHub list to import."
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border border-border/60 bg-card/60 shadow-md">
            <CardHeader className="space-y-4">
              <div className="space-y-1">
                <CardTitle>GitHub repositories</CardTitle>
                <CardDescription>Import projects to share with experts.</CardDescription>
              </div>
              <div className="space-y-2">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="repo-search"
                    placeholder="Search GitHub projects"
                    className="pl-9"
                    value={repoSearch}
                    onChange={(event) => setRepoSearch(event.target.value)}
                    disabled={reposQuery.isLoading || !totalAvailableRepos}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {reposQuery.isLoading ? (
                <div className="flex min-h-[420px] flex-col justify-center gap-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : reposQuery.data?.length ? (
                reposToDisplay.length ? (
                  <div className="space-y-3 min-h-[420px]">
                    {reposToDisplay.map((repo: GithubRepo) => {
                      const alreadyImported = importedRepoIds.has(repo.id);
                      const repoFullName = repo.owner ? `${repo.owner}/${repo.name}` : repo.name;
                      return (
                        <div
                          key={repo.id}
                          className="flex min-h-[120px] flex-col justify-between rounded-xl border border-border/60 bg-background/90 p-4 transition-colors md:flex-row md:items-start md:justify-between"
                        >
                          <div className="space-y-2 md:max-w-[70%]">
                            <div className="flex items-start gap-2">
                              <p className="font-medium truncate" title={repo.name}>
                                {repo.name}
                              </p>
                              {repo.owner && (
                                <Badge variant="outline" className="max-w-[140px] truncate text-xs font-normal uppercase tracking-wide text-muted-foreground">
                                  {repo.owner}
                                </Badge>
                              )}
                            </div>
                            {repo.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {repo.description}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Star className="h-3.5 w-3.5" aria-hidden />
                                {repo.stargazers_count ?? 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <GitFork className="h-3.5 w-3.5" aria-hidden />
                                {repo.forks_count ?? 0}
                              </span>
                              <span>
                                Updated {repo.updated_at ? new Date(repo.updated_at).toLocaleDateString() : "--"}
                              </span>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant={alreadyImported ? "secondary" : "default"}
                            disabled={importProjectMutation.isPending || alreadyImported}
                            onClick={() => importProjectMutation.mutate(repoFullName)}
                          >
                            {alreadyImported ? "Imported" : "Import"}
                          </Button>
                        </div>
                      );
                    })}
                    <p className="text-xs text-muted-foreground">
                      Showing {reposToDisplay.length} of {totalAvailableRepos} repositories
                      {repoSearch ? " matching your search." : " sorted by most recently updated."}
                    </p>
                  </div>
                ) : (
                  <div className="flex min-h-[420px] flex-col items-center gap-3 py-10 text-center">
                    <p className="text-sm text-muted-foreground">
                      No repositories match your search.
                    </p>
                    <Button size="sm" variant="outline" onClick={() => setRepoSearch("")}>
                      Clear search
                    </Button>
                  </div>
                )
              ) : (
                <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    We could not retrieve your repositories. Make sure GitHub access is granted.
                  </p>
                  <Button
                    onClick={async () => {
                      try {
                        const response = await fetch("/api/auth/login");
                        const data = await response.json();
                        if (data.success && data.data.auth_url) {
                          window.location.href = data.data.auth_url;
                        }
                      } catch {
                        toast.error("Failed to initiate GitHub authorization");
                      }
                    }}
                  >
                    Grant GitHub Access
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function ProjectCard({
  project,
  compact = false,
  profile = null,
}: {
  project: Project;
  compact?: boolean;
  profile?: Profile | null;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-background/95 shadow-md",
        compact && "bg-muted/40"
      )}
    >
      <div className={cn("flex flex-col gap-4", compact ? "p-4" : "p-6")}>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-base font-semibold">{project.name}</p>
              {project.language && <Badge variant="outline">{project.language}</Badge>}
            </div>
            {project.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {project.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5" aria-hidden />
                {project.stars ?? 0}
              </span>
              <span className="flex items-center gap-1">
                <GitFork className="h-3.5 w-3.5" aria-hidden />
                {project.forks ?? 0}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" aria-hidden />
                {project.watchers ?? 0}
              </span>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <ProjectDocumentationSheet project={project} profile={profile} compact={compact} />
            {project.html_url && (
              <Button asChild variant="ghost" size="sm">
                <a href={project.html_url} target="_blank" rel="noreferrer">
                  View on GitHub
                </a>
              </Button>
            )}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Last synced: {project.last_synced_at ? new Date(project.last_synced_at).toLocaleString() : "--"}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/40 p-10 text-center shadow-sm">
      <p className="text-base font-semibold">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

interface StatTileProps {
  title: string;
  description?: string;
  value: string;
  icon?: ComponentType<{ className?: string }>;
  loading?: boolean;
}

function StatTile({ title, description, value, icon: Icon, loading }: StatTileProps) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/80 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">{title}</p>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground/80">{description}</p>
          )}
        </div>
        {Icon && <Icon className="h-5 w-5 text-muted-foreground/70" />}
      </div>
      <div className="mt-4">
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-2xl font-semibold text-foreground">{value}</p>
        )}
      </div>
    </div>
  );
}
