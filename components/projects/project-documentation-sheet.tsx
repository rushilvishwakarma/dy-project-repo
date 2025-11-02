"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, RotateCcw } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { ProjectDocumentationEditor, TipTapJSON } from "@/components/projects/project-documentation-editor";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { useAuthorizedFetch } from "@/hooks/use-authorized-fetch";
import { parseStandardResponse } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Profile, Project, ProjectDocumentation } from "@/types";

const emptyDocument: TipTapJSON = {
	type: "doc",
	content: [{ type: "paragraph" }],
};

const AUTO_SAVE_DELAY_MS = 900;

interface ProjectDocumentationSheetProps {
	project: Project;
	profile: Profile | null;
	triggerClassName?: string;
	compact?: boolean;
}

type DocumentationPayload = {
	json: TipTapJSON;
	text: string;
};

export function ProjectDocumentationSheet({
	project,
	profile,
	triggerClassName,
	compact = false,
}: ProjectDocumentationSheetProps) {
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState<DocumentationPayload | null>(null);
	const [hasLocalChanges, setHasLocalChanges] = useState(false);
	const [pendingPayload, setPendingPayload] = useState<DocumentationPayload | null>(null);

	const queryClient = useQueryClient();
	const authorizedFetch = useAuthorizedFetch();

	const isOwner = profile?.id === project.user_id;
	const canEdit = Boolean(isOwner);
	const isExpertViewer = !canEdit && profile?.role === "expert";

	const documentationQuery = useQuery<ProjectDocumentation | null>({
		queryKey: ["project-documentation", project.id],
		queryFn: async () => {
			const response = await authorizedFetch(`/api/projects/${project.id}/documentation`);
			return parseStandardResponse<ProjectDocumentation | null>(response);
		},
		enabled: open,
		staleTime: 60_000,
	});

	const loadErrorMessage = documentationQuery.error instanceof Error ? documentationQuery.error.message : null;
	const lastUpdatedRaw = documentationQuery.data?.updated_at ?? null;

	const documentationMutation = useMutation<ProjectDocumentation | null, Error, DocumentationPayload>({
		mutationFn: async (payload) => {
			const response = await authorizedFetch(`/api/projects/${project.id}/documentation`, {
				method: "PUT",
				body: JSON.stringify({
					content: payload.json,
					content_text: payload.text,
				}),
			});
			return parseStandardResponse<ProjectDocumentation | null>(response);
		},
		onSuccess: (data) => {
			setHasLocalChanges(false);
			setPendingPayload(null);
			if (data) {
				queryClient.setQueryData(["project-documentation", project.id], data);
			} else {
				queryClient.invalidateQueries({ queryKey: ["project-documentation", project.id] });
			}
		},
		onError: (error) => {
			setPendingPayload(null);
			toast.error(summarizeMutationError(error));
		},
	});

	const { mutate: saveDocumentation, isPending: isSavingDocumentation } = documentationMutation;

	// Reset local draft state whenever the sheet closes.
	// eslint-disable-next-line react-hooks/set-state-in-effect
	useEffect(() => {
		if (!open) {
			setDraft(null);
			setHasLocalChanges(false);
			setPendingPayload(null);
		}
	}, [open]);

	// Hydrate editor state from the latest documentation payload.
	// eslint-disable-next-line react-hooks/set-state-in-effect
	useEffect(() => {
		if (!open || !documentationQuery.isSuccess) return;
		const json = normalizeContent(documentationQuery.data?.content);
		const text = documentationQuery.data?.content_text ?? "";
		setDraft({ json, text });
		setHasLocalChanges(false);
		setPendingPayload(null);
	}, [documentationQuery.data, documentationQuery.isSuccess, open]);

	useEffect(() => {
		if (!open) return;
		if (!canEdit) return;
		if (!hasLocalChanges) return;
		if (!pendingPayload) return;
		if (isSavingDocumentation) return;

		const timer = window.setTimeout(() => {
			saveDocumentation(pendingPayload);
			setPendingPayload(null);
		}, AUTO_SAVE_DELAY_MS);

		return () => window.clearTimeout(timer);
	}, [canEdit, hasLocalChanges, open, pendingPayload, isSavingDocumentation, saveDocumentation]);

	const handleContentChange = useCallback(
		(payload: DocumentationPayload) => {
			if (!canEdit) return;
			setDraft(payload);
			setHasLocalChanges(true);
			setPendingPayload(payload);
		},
		[canEdit]
	);

	const statusLabel = useMemo(() => {
		if (isSavingDocumentation) return "Saving changes…";
		if (canEdit && hasLocalChanges) return "Unsaved changes";
		if (lastUpdatedRaw) return `Last updated ${new Date(lastUpdatedRaw).toLocaleString()}`;
		return "No documentation saved yet.";
	}, [canEdit, hasLocalChanges, isSavingDocumentation, lastUpdatedRaw]);

	const editorContent = draft?.json ?? emptyDocument;
	const triggerLabel = "Documentation";

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger asChild>
				<Button
					size="sm"
					variant={compact ? "ghost" : "outline"}
					className={cn("gap-2", triggerClassName)}
				>
					<FileText className="h-4 w-4" />
					{compact ? <span className="sr-only">{triggerLabel}</span> : triggerLabel}
				</Button>
			</SheetTrigger>
			<SheetContent side="right" className="sm:max-w-2xl">
				<SheetHeader>
					<div className="flex flex-col gap-2">
						<SheetTitle>{project.name} documentation</SheetTitle>
						<SheetDescription>
							{canEdit
								? "Capture architecture decisions, implementation details, and walkthroughs for expert review."
								: "Review the documentation provided by the project owner."}
						</SheetDescription>
						<motion.div
							layout
							className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
						>
							<span>{statusLabel}</span>
							{isExpertViewer && (
								<span className="rounded-full border border-border/60 px-2 py-0.5">Read only</span>
							)}
						</motion.div>
					</div>
				</SheetHeader>

				<div className="mt-6 flex h-[70vh] flex-col">
					{documentationQuery.isLoading && (
						<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
							<Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading documentation…
						</div>
					)}

					{documentationQuery.isError && !documentationQuery.isLoading && (
						<div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 text-center">
							<p className="text-sm text-muted-foreground">
								{loadErrorMessage ? summarizeLoadError(loadErrorMessage) : "Unable to load documentation."}
							</p>
							<Button size="sm" variant="outline" onClick={() => documentationQuery.refetch()}>
								<RotateCcw className="mr-2 h-4 w-4" /> Retry
							</Button>
						</div>
					)}

					{!documentationQuery.isLoading && !documentationQuery.isError && (
						<ProjectDocumentationEditor
							key={`${project.id}-${canEdit ? "edit" : "view"}`}
							content={editorContent}
							readOnly={!canEdit}
							isSaving={isSavingDocumentation && canEdit}
							onContentChange={handleContentChange}
						/>
					)}
				</div>

				<SheetFooter className="pt-4">
					<div className="flex w-full items-center justify-between text-xs text-muted-foreground">
						{canEdit ? (
							<span>
								{isSavingDocumentation
									? "Auto-saving in progress"
									: hasLocalChanges
										? "Unsaved changes"
										: "All changes saved"}
							</span>
						) : (
							<span>Documentation is locked for reviewer mode.</span>
						)}
						<div className="flex items-center gap-2">
							{canEdit && (
								<Button
									type="button"
									variant="secondary"
									size="sm"
									onClick={() => {
										if (!draft) return;
										setPendingPayload(null);
										saveDocumentation(draft);
									}}
									disabled={isSavingDocumentation || !hasLocalChanges}
								>
									{isSavingDocumentation ? (
										<span className="flex items-center gap-2">
											<Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
										</span>
									) : (
										"Save now"
									)}
								</Button>
							)}
							<Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
								Close
							</Button>
						</div>
					</div>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}

function normalizeContent(raw: unknown): TipTapJSON {
	if (!raw) return emptyDocument;
	if (typeof raw === "string") {
		try {
			const parsed = JSON.parse(raw);
			return normalizeContent(parsed);
		} catch {
			return emptyDocument;
		}
	}
	if (typeof raw === "object" && raw !== null) {
		return raw as TipTapJSON;
	}
	return emptyDocument;
}

function summarizeLoadError(message: string): string {
	const normalized = message.toLowerCase();
	if (normalized.includes("not configured")) {
		return "Project documentation storage is not configured yet. Ask an administrator to run the latest migration.";
	}
	if (normalized.includes("could not find the table")) {
		return "Project documentation storage is missing in Supabase.";
	}
	return message;
}

function summarizeMutationError(error: Error): string {
	const message = error.message ?? "Failed to save documentation.";
	const normalized = message.toLowerCase();
	if (normalized.includes("not configured")) {
		return "Unable to save documentation because storage is not configured. Run the latest database migration and try again.";
	}
	if (normalized.includes("could not find the table")) {
		return "Project documentation storage is missing. Ask an administrator to run the required migration.";
	}
	return message;
}

