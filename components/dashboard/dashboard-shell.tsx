"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthorizedFetch } from "@/hooks/use-authorized-fetch";
import { parseStandardResponse } from "@/lib/api-client";
import {
  GithubActivityItem,
  GithubContributionSummary,
  GithubRepo,
  GithubUser,
  Profile,
  Project,
  ExpertProjectGroup,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  profile: Profile | null;
}

export function DashboardShell({ profile }: DashboardShellProps) {
  const authorizedFetch = useAuthorizedFetch();
  const queryClient = useQueryClient();

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

  const activityQuery = useQuery<GithubActivityItem[]>({
    queryKey: ["github-activity"],
    queryFn: async () => {
      const response = await authorizedFetch("/api/github/activity");
      return parseStandardResponse<GithubActivityItem[]>(response);
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
    onError: (error: unknown) => {
      toast.error((error as Error).message);
    },
  });

  const importedRepoIds = useMemo(() => {
    const projects = projectsQuery.data ?? [];
    return new Set(projects.map((project: Project) => project.github_repo_id));
  }, [projectsQuery.data]);

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          {githubUserQuery.isLoading ? (
            <Skeleton className="h-16 w-16 rounded-full" />
          ) : (
            <Avatar className="h-16 w-16">
              <AvatarImage src={githubUserQuery.data?.avatar_url ?? undefined} alt={githubUserQuery.data?.username} />
              <AvatarFallback>{githubUserQuery.data?.username?.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          )}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">
                {githubUserQuery.data?.username ?? "GitHub User"}
              </h1>
              <Badge variant="secondary">{profile?.role ?? "developer"}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {githubUserQuery.data?.html_url ? (
                <a
                  href={githubUserQuery.data.html_url}
                  className="text-primary underline-offset-4 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {githubUserQuery.data.html_url}
                </a>
              ) : (
                "Connect GitHub to start importing projects"
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <p className="text-sm text-muted-foreground">
            Total contributions last year
          </p>
          <p className="text-2xl font-semibold">
            {contributionsQuery.data?.total_contributions ?? "--"}
          </p>
        </div>
      </header>

      <Tabs defaultValue={profile?.role === "expert" ? "expert" : "developer"} className="w-full">
        <TabsList>
          <TabsTrigger value="developer">Developer View</TabsTrigger>
          <TabsTrigger value="expert" disabled={profile?.role !== "expert"}>
            Expert View
          </TabsTrigger>
        </TabsList>
        <TabsContent value="developer" className="space-y-8">
          <section className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Imported Projects</CardTitle>
                <CardDescription>Your curated list synced from GitHub</CardDescription>
              </CardHeader>
              <CardContent>
                {projectsQuery.isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : projectsQuery.data?.length ? (
                  <div className="space-y-4">
                    {projectsQuery.data.map((project: Project) => (
                      <ProjectCard key={project.id} project={project} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No projects imported yet"
                    description="Select a repository from your GitHub list to import."
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Last 10 GitHub events</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {activityQuery.isLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : activityQuery.data?.length ? (
                  <ul className="space-y-2 text-sm">
                    {activityQuery.data.map((event: GithubActivityItem) => (
                      <li key={event.id} className="rounded-md border border-border p-3">
                        <p className="font-medium">{event.type ?? "Event"}</p>
                        <p className="text-muted-foreground">{event.repo ?? "Repository"}</p>
                        {event.created_at && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(event.created_at).toLocaleString()}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No activity found.</p>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">GitHub Repositories</h2>
                <p className="text-sm text-muted-foreground">
                  Import projects to share with experts. Private repos stay private but metadata is stored securely.
                </p>
              </div>
            </header>
            <Card>
              <CardContent className="p-0">
                {reposQuery.isLoading ? (
                  <div className="space-y-3 p-6">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : reposQuery.data?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Repository</TableHead>
                        <TableHead className="hidden lg:table-cell">Stars</TableHead>
                        <TableHead className="hidden lg:table-cell">Forks</TableHead>
                        <TableHead className="hidden lg:table-cell">Updated</TableHead>
                        <TableHead className="w-[140px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reposQuery.data.map((repo: GithubRepo) => {
                        const alreadyImported = importedRepoIds.has(repo.id);
                        const repoFullName = repo.owner ? `${repo.owner}/${repo.name}` : repo.name;
                        return (
                          <TableRow key={repo.id}>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium">{repo.name}</p>
                                {repo.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-2">
                                    {repo.description}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">{repo.stargazers_count}</TableCell>
                            <TableCell className="hidden lg:table-cell">{repo.forks_count}</TableCell>
                            <TableCell className="hidden lg:table-cell">
                              {repo.updated_at ? new Date(repo.updated_at).toLocaleDateString() : "--"}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant={alreadyImported ? "secondary" : "default"}
                                disabled={importProjectMutation.isPending || alreadyImported}
                                onClick={() => importProjectMutation.mutate(repoFullName)}
                              >
                                {alreadyImported ? "Imported" : "Import"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 space-y-4">
                    <EmptyState
                      title="No repositories found"
                      description="We could not retrieve your repositories. Make sure GitHub access is granted."
                    />
                    <Button
                      onClick={async () => {
                        try {
                          const response = await fetch("/api/auth/login");
                          const data = await response.json();
                          if (data.success && data.data.auth_url) {
                            window.location.href = data.data.auth_url;
                          }
                        } catch (error) {
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
          </section>
        </TabsContent>

        <TabsContent value="expert" className="space-y-8">
          {profile?.role !== "expert" ? (
            <EmptyState
              title="Expert access required"
              description="Upgrade the user's role in Supabase to review developers' portfolios."
            />
          ) : expertProjectsQuery.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : expertProjectsQuery.data?.length ? (
            <div className="space-y-6">
              {expertProjectsQuery.data.map((group: ExpertProjectGroup) => (
                <Card key={group.owner_id}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={group.owner?.avatar_url ?? undefined} />
                        <AvatarFallback>
                          {group.owner?.username?.slice(0, 2).toUpperCase() ?? "DV"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle>{group.owner?.full_name ?? group.owner?.username ?? "Developer"}</CardTitle>
                        <CardDescription>
                          {group.owner?.username ? `@${group.owner.username}` : "Unlinked profile"}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {group.projects.map((project: Project) => (
                      <ProjectCard key={project.id} project={project} compact />
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No developer submissions yet"
              description="Encourage developers to import their GitHub repositories to review them here."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProjectCard({ project, compact = false }: { project: Project; compact?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-background p-4 transition hover:shadow-sm",
        compact && "p-3"
      )}
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <p className="text-base font-semibold">{project.name}</p>
            {project.language && <Badge variant="outline">{project.language}</Badge>}
          </div>
          {project.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {project.description}
            </p>
          )}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>⭐ {project.stars ?? 0}</span>
            <span>🍴 {project.forks ?? 0}</span>
            <span>👀 {project.watchers ?? 0}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {project.html_url && (
            <Button asChild variant="ghost" size="sm">
              <a href={project.html_url} target="_blank" rel="noreferrer">
                View on GitHub
              </a>
            </Button>
          )}
          <Button asChild size="sm" variant="secondary">
            <Link href={`/projects/${project.id}`}>Open</Link>
          </Button>
        </div>
      </div>
      <div className="mt-3 text-xs text-muted-foreground">
        <p>
          Last synced: {project.last_synced_at ? new Date(project.last_synced_at).toLocaleString() : "--"}
        </p>
      </div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
      <p className="text-base font-semibold">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
