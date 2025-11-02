import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertSupabaseUser } from "@/lib/auth";
import { standardResponse } from "@/lib/response";
import { adminClient } from "@/lib/supabase/admin";
import { getProfileByUserId } from "@/lib/profiles";

const updateSchema = z.object({
  content: z.unknown().optional(),
  content_text: z.string().max(20000).optional().nullable(),
});

async function ensureAccess(projectId: string, userId: string) {
  const profile = await getProfileByUserId(userId);
  const { data, error } = await adminClient
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .maybeSingle<{ id: string; user_id: string }>();

  if (error) throw new Error(error.message);
  if (!data) {
    return { project: null, profile, isOwner: false, isExpert: profile?.role === "expert" } as const;
  }

  const isOwner = data.user_id === userId;
  const isExpert = profile?.role === "expert";
  if (!isOwner && !isExpert) {
    throw Object.assign(new Error("Not authorized"), { status: 403 });
  }

  return { project: data, profile, isOwner, isExpert } as const;
}

function isTableMissing(error: { message?: string | null; code?: string | null } | null | undefined) {
  if (!error) return false;
  const normalizedMessage = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST116" ||
    error.code === "PGRST101" ||
    normalizedMessage.includes("could not find the table") ||
    normalizedMessage.includes("relationship 'project_documentation'")
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await assertSupabaseUser(request);
    const { project } = await ensureAccess(id, user.id);

    if (!project) {
      return NextResponse.json(
        standardResponse(false, undefined, 404, "Project not found"),
        { status: 404 }
      );
    }

    const { data, error } = await adminClient
      .from("project_documentation")
      .select("project_id, content, content_text, updated_at, updated_by")
      .eq("project_id", id)
      .maybeSingle();

    if (error) {
      if (isTableMissing(error)) {
        return NextResponse.json(standardResponse(true, null, 200));
      }
      throw new Error(error.message);
    }

    return NextResponse.json(standardResponse(true, data ?? null, 200));
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await assertSupabaseUser(request);
    const { project, isOwner } = await ensureAccess(id, user.id);

    if (!project) {
      return NextResponse.json(
        standardResponse(false, undefined, 404, "Project not found"),
        { status: 404 }
      );
    }

    if (!isOwner) {
      return NextResponse.json(
        standardResponse(false, undefined, 403, "Only project owners can update documentation"),
        { status: 403 }
      );
    }

    const payload = updateSchema.parse(await request.json());

    const { data, error } = await adminClient
      .from("project_documentation")
      .upsert(
        {
          project_id: id,
          content: payload.content ?? null,
          content_text: payload.content_text ?? null,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        },
        { onConflict: "project_id" }
      )
      .select("project_id, content, content_text, updated_at, updated_by")
      .maybeSingle();

    if (error) {
      if (isTableMissing(error)) {
        return NextResponse.json(
          standardResponse(false, undefined, 503, "Project documentation storage is not configured. Please run the associated migration."),
          { status: 503 }
        );
      }
      throw new Error(error.message);
    }

    return NextResponse.json(standardResponse(true, data ?? null, 200));
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
