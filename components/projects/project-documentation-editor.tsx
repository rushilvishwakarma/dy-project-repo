"use client";

import { useEffect, useMemo, useRef } from "react";
import { EditorContent, JSONContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import Blockquote from "@tiptap/extension-blockquote";
import { motion } from "motion/react";
import {
	Bold,
	Heading1,
	Heading2,
	Heading3,
	Italic,
	List as ListIcon,
	ListOrdered,
	Minus,
	Quote,
	Redo2,
	Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TipTapJSON = JSONContent;

const emptyDocument: TipTapJSON = {
	type: "doc",
	content: [{ type: "paragraph" }],
};

interface ProjectDocumentationEditorProps {
	content?: TipTapJSON | null;
	readOnly?: boolean;
	isSaving?: boolean;
	onContentChange?: (payload: { json: TipTapJSON; text: string }) => void;
}

export function ProjectDocumentationEditor({
	content,
	readOnly = false,
	isSaving = false,
	onContentChange,
}: ProjectDocumentationEditorProps) {
	const latestSerialized = useMemo(() => JSON.stringify(content ?? emptyDocument), [content]);
	const skipFirstUpdate = useRef(true);

	const editor = useEditor({
		immediatelyRender: false,
			extensions: [
				StarterKit.configure({
					heading: {
						levels: [1, 2, 3],
					},
				}),
			Underline,
			Link.configure({
				HTMLAttributes: {
					class: "text-primary underline-offset-4 hover:underline",
				},
			}),
			BulletList,
			OrderedList,
			Blockquote,
			Placeholder.configure({
				placeholder: readOnly
					? "Documentation has not been provided yet."
					: "Document your architecture, decisions, and progress…",
			}),
		],
		content: content ?? emptyDocument,
		editable: !readOnly,
		onUpdate: ({ editor, transaction }) => {
			if (!transaction.docChanged) return;
			if (skipFirstUpdate.current) {
				skipFirstUpdate.current = false;
				return;
			}
			const json = editor.getJSON();
			const text = editor.getText();
			onContentChange?.({ json, text });
		},
	});

	useEffect(() => {
		if (!editor) return;
		if (!readOnly) {
			editor.commands.focus("end");
		}
	}, [editor, readOnly]);

	useEffect(() => {
		if (!editor) return;
		const current = JSON.stringify(editor.getJSON());
		if (current === latestSerialized) return;
		editor.commands.setContent(content ?? emptyDocument, { emitUpdate: false });
		skipFirstUpdate.current = true;
	}, [editor, content, latestSerialized]);

	useEffect(() => {
		if (!editor) return;
		editor.setEditable(!readOnly);
	}, [editor, readOnly]);

	if (!editor) {
		return (
			<div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
				Initializing editor…
			</div>
		);
	}

	const controls = [
		{
			icon: Bold,
			label: "Bold",
			action: () => editor.chain().focus().toggleBold().run(),
			active: editor.isActive("bold"),
			disabled: false,
		},
		{
			icon: Italic,
			label: "Italic",
			action: () => editor.chain().focus().toggleItalic().run(),
			active: editor.isActive("italic"),
			disabled: false,
		},
		{
			icon: Heading1,
			label: "Heading 1",
			action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
			active: editor.isActive("heading", { level: 1 }),
			disabled: false,
		},
		{
			icon: Heading2,
			label: "Heading 2",
			action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
			active: editor.isActive("heading", { level: 2 }),
			disabled: false,
		},
		{
			icon: Heading3,
			label: "Heading 3",
			action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
			active: editor.isActive("heading", { level: 3 }),
			disabled: false,
		},
		{
			icon: ListIcon,
			label: "Bullet list",
			action: () => editor.chain().focus().toggleBulletList().run(),
			active: editor.isActive("bulletList"),
			disabled: false,
		},
		{
			icon: ListOrdered,
			label: "Numbered list",
			action: () => editor.chain().focus().toggleOrderedList().run(),
			active: editor.isActive("orderedList"),
			disabled: false,
		},
		{
			icon: Quote,
			label: "Quote",
			action: () => editor.chain().focus().toggleBlockquote().run(),
			active: editor.isActive("blockquote"),
			disabled: false,
		},
		{
			icon: Minus,
			label: "Divider",
			action: () => editor.chain().focus().setHorizontalRule().run(),
			active: false,
			disabled: false,
		},
	] as const;

	return (
		<div className="flex h-full flex-col gap-3">
			<motion.div
				layout
				transition={{ type: "spring", stiffness: 300, damping: 25 }}
				className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/20 p-2"
			>
				{controls.map(({ icon: Icon, label, action, active, disabled }) => (
					<Button
						key={label}
						type="button"
						size="icon"
						variant={active ? "secondary" : "ghost"}
						onClick={action}
						disabled={readOnly || disabled}
						className={cn("h-8 w-8", readOnly && "opacity-70")}
						aria-label={label}
						aria-pressed={active}
					>
						<Icon className="h-4 w-4" />
					</Button>
				))}
				<span className="mx-1 h-5 w-px bg-border/70" aria-hidden />
				<Button
					type="button"
					size="icon"
					variant="ghost"
					onClick={() => editor.chain().focus().undo().run()}
					disabled={readOnly || !editor.can().undo()}
					className="h-8 w-8"
					aria-label="Undo"
				>
					<Undo2 className="h-4 w-4" />
				</Button>
				<Button
					type="button"
					size="icon"
					variant="ghost"
					onClick={() => editor.chain().focus().redo().run()}
					disabled={readOnly || !editor.can().redo()}
					className="h-8 w-8"
					aria-label="Redo"
				>
					<Redo2 className="h-4 w-4" />
				</Button>
				<span className="ml-auto text-xs text-muted-foreground">
					{readOnly ? "Read only" : isSaving ? "Saving…" : "Auto-save enabled"}
				</span>
			</motion.div>
					<div className="relative flex-1 overflow-hidden rounded-xl border border-border/60 bg-background/40">
				<EditorContent
					editor={editor}
					onClick={() => editor.chain().focus().run()}
					className={cn(
						"document-editor-scroll h-full overflow-y-auto px-5 py-4 text-sm leading-relaxed",
						"focus:outline-none",
						"[&_*]:max-w-full [&_strong]:font-semibold [&_h1]:text-2xl [&_h2]:text-xl [&_h3]:text-lg",
						"[&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold",
						"[&_ul]:ml-5 [&_ul]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal"
					)}
				/>
			</div>
		</div>
	);
}
