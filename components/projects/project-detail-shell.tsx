"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useAuthorizedFetch } from "@/hooks/use-authorized-fetch";
import { parseStandardResponse } from "@/lib/api-client";
import { GithubRepo, Profile, Project, ProjectDocument } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const metadataSchema = z.object({
  notes: z.string().max(10_000).optional().nullable(),
  status: z.enum(["draft", "in_review", "published"]).optional(),
  tags: z.array(z.string()).optional(),
});

const attachmentTypes = "application/pdf,image/*";

interface ProjectDetailShellProps {
  projectId: string;
  profile: Profile | null;
}

export function ProjectDetailShell({ projectId, profile }: ProjectDetailShellProps) {
  const authorizedFetch = useAuthorizedFetch();
  const queryClient = useQueryClient();
  const [tagInput, setTagInput] = useState("");

  const projectQuery = useQuery<Project>({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const response = await authorizedFetch(`/api/projects/${projectId}`);
      return parseStandardResponse<Project>(response);
    },
  });

  const documentsQuery = useQuery<ProjectDocument[]>({
    queryKey: ["project-documents", projectId],
    queryFn: async () => {
      const response = await authorizedFetch(`/api/projects/${projectId}/attachments`);
      return parseStandardResponse<ProjectDocument[]>(response);
    },
  });

  const repoQuery = useQuery<GithubRepo>({
    queryKey: ["github-repo", projectQuery.data?.repository_full_name],
    queryFn: async () => {
      const project = projectQuery.data;
      if (!project?.repository_full_name) {
        throw new Error("Repository reference missing");
      }
      const response = await authorizedFetch(`/api/github/repos?full_name=${encodeURIComponent(project.repository_full_name)}`);
      return parseStandardResponse<GithubRepo>(response);
    },
    enabled: Boolean(projectQuery.data?.repository_full_name),
  });

  const form = useForm<z.infer<typeof metadataSchema>>({
    resolver: zodResolver(metadataSchema),
    defaultValues: {
      notes: projectQuery.data?.notes ?? "",
      status: projectQuery.data?.status ?? "draft",
      tags: projectQuery.data?.tags ?? [],
    },
  });

  useEffect(() => {
    if (projectQuery.data) {
      form.reset({
        notes: projectQuery.data.notes ?? "",
        status: (projectQuery.data.status as "draft" | "in_review" | "published") ?? "draft",
        tags: projectQuery.data.tags ?? [],
      });
    }
  }, [projectQuery.data, form]);

  const updateMetadataMutation = useMutation<Project, Error, z.infer<typeof metadataSchema>>({
    mutationFn: async (payload: z.infer<typeof metadataSchema>) => {
      const response = await authorizedFetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      return parseStandardResponse<Project>(response);
    },
    onSuccess: (project: Project) => {
      toast.success("Project details updated");
      queryClient.setQueryData(["project", projectId], project);
      queryClient.invalidateQueries({ queryKey: ["projects", "developer"] });
      queryClient.invalidateQueries({ queryKey: ["projects", "expert"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const uploadAttachmentsMutation = useMutation<ProjectDocument[], Error, File[]>({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file: File) => formData.append("files", file));
      const response = await authorizedFetch(`/api/projects/${projectId}/attachments`, {
        method: "POST",
        body: formData,
      });
      return parseStandardResponse<ProjectDocument[]>(response);
    },
    onSuccess: () => {
      toast.success("Attachments uploaded");
      queryClient.invalidateQueries({ queryKey: ["project-documents", projectId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const canEdit = useMemo(() => {
    const project = projectQuery.data;
    if (!project || !profile) return false;
    const isOwner = project.user_id === profile.id;
    const isExpert = profile.role === "expert";
    return isOwner || isExpert;
  }, [projectQuery.data, profile]);

  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    const existing = form.getValues("tags") ?? [];
    const newTag = tagInput.trim();
    if (existing.includes(newTag)) {
      toast.info("Tag already added");
      return;
    }
    form.setValue("tags", [...existing, newTag]);
    setTagInput("");
  };

  const handleRemoveTag = (tag: string) => {
  const filtered = (form.getValues("tags") ?? []).filter((item: string) => item !== tag);
    form.setValue("tags", filtered);
  };

  const onSubmit = (values: z.infer<typeof metadataSchema>) => {
    updateMetadataMutation.mutate({
      ...values,
      tags: values.tags ?? [],
    });
  };

  const onFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;
    const files = Array.from(event.target.files);
    uploadAttachmentsMutation.mutate(files);
    event.target.value = "";
  };

  if (projectQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Project unavailable</CardTitle>
          <CardDescription>
            We could not load this project. It may have been removed or you may not have access rights.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const project = projectQuery.data;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{project.name}</h1>
          {project.language && <Badge variant="outline">{project.language}</Badge>}
        </div>
        <p className="max-w-3xl text-base text-muted-foreground">{project.description}</p>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>⭐ {project.stars ?? 0}</span>
          <span>🍴 {project.forks ?? 0}</span>
          <span>👀 {project.watchers ?? 0}</span>
          <span>Visibility: {project.private ? "Private" : "Public"}</span>
        </div>
        <div className="flex items-center gap-3">
          {project.html_url && (
            <Button asChild size="sm">
              <a href={project.html_url} target="_blank" rel="noreferrer">
                Open on GitHub
              </a>
            </Button>
          )}
          <Badge variant="secondary">Status: {project.status ?? "draft"}</Badge>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Project metadata</CardTitle>
            <CardDescription>Maintain context, review notes, and editorial status.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add highlights, feedback, or review notes"
                  {...form.register("notes")}
                  disabled={!canEdit || updateMetadataMutation.isPending}
                  rows={5}
                />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={projectQuery.data?.status ?? "draft"}
                  onValueChange={(value: string) =>
                    form.setValue("status", value as "draft" | "in_review" | "published")
                  }
                  disabled={!canEdit || updateMetadataMutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="in_review">In review</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tags">Tags</Label>
                <div className="flex gap-2">
                  <Input
                    id="tags"
                    placeholder="Add a tag and press enter"
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleAddTag();
                      }
                    }}
                    disabled={!canEdit}
                  />
                  <Button type="button" variant="secondary" onClick={handleAddTag} disabled={!canEdit}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(projectQuery.data?.tags ?? []).map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-2">
                      <span>{tag}</span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          ×
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
              {canEdit && (
                <Button type="submit" disabled={updateMetadataMutation.isPending}>
                  {updateMetadataMutation.isPending ? "Saving..." : "Save changes"}
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
            <CardDescription>Upload supporting documents or certificates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canEdit && (
              <div className="rounded-md border border-dashed border-border p-4 text-sm">
                <p className="font-medium">Upload files</p>
                <p className="text-muted-foreground">
                  Accepted types: PDFs or images. Attach up to 10 files per submission.
                </p>
                <div className="mt-3">
                  <Input
                    type="file"
                    accept={attachmentTypes}
                    multiple
                    onChange={onFileSelect}
                    disabled={uploadAttachmentsMutation.isPending}
                  />
                </div>
              </div>
            )}
            <div className="max-h-72 overflow-y-auto">
              {documentsQuery.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : documentsQuery.data?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead className="hidden sm:table-cell">Type</TableHead>
                      <TableHead className="hidden sm:table-cell">Size</TableHead>
                      <TableHead>Added</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentsQuery.data.map((doc: ProjectDocument) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          {doc.file_url ? (
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                            >
                              {doc.file_name}
                            </a>
                          ) : (
                            <span className="text-sm font-medium">{doc.file_name}</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {doc.content_type ?? "--"}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {doc.size ? `${Math.round(doc.size / 1024)} KB` : "--"}
                        </TableCell>
                        <TableCell>
                          {doc.created_at ? new Date(doc.created_at).toLocaleString() : "--"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">No attachments uploaded yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Repository snapshot</CardTitle>
          <CardDescription>Metadata captured during the last sync from GitHub.</CardDescription>
        </CardHeader>
        <CardContent>
          {repoQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : repoQuery.data ? (
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Description term="Repository">
                <a
                  href={repoQuery.data.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {repoQuery.data.name}
                </a>
              </Description>
              <Description term="Default branch">{repoQuery.data.default_branch ?? "main"}</Description>
              <Description term="Created">
                {repoQuery.data.created_at ? new Date(repoQuery.data.created_at).toLocaleDateString() : "--"}
              </Description>
              <Description term="Last updated">
                {repoQuery.data.updated_at ? new Date(repoQuery.data.updated_at).toLocaleString() : "--"}
              </Description>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              Repository details are unavailable. This could be due to revoked GitHub permissions.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Description({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{term}</span>
      <span className="text-sm font-medium text-foreground">{children}</span>
    </div>
  );
}
