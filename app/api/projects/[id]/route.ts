import { NextRequest, NextResponse } from "next/server";
import { assertSupabaseUser } from "@/lib/auth";
import { standardResponse } from "@/lib/response";
import { adminClient } from "@/lib/supabase/admin";
import { getProfileByUserId } from "@/lib/profiles";
import { z } from "zod";

const updateSchema = z.object({
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["draft", "in_review", "published"]).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await assertSupabaseUser(request);
    const profile = await getProfileByUserId(user.id);

    type ProjectWithDocuments = Record<string, unknown> & { user_id?: string };

    const { data, error } = await adminClient
      .from("projects")
      .select("*, documents:project_documents(id, file_name, file_url, content_type, created_at)")
      .eq("id", params.id)
      .maybeSingle<ProjectWithDocuments>();

    if (error) throw new Error(error.message);
    if (!data) {
      return NextResponse.json(
        standardResponse(false, undefined, 404, "Project not found"),
        { status: 404 }
      );
    }

    const isOwner = data.user_id === user.id;
    const isExpert = profile?.role === "expert";
    if (!isOwner && !isExpert) {
      return NextResponse.json(
        standardResponse(false, undefined, 403, "Not authorized"),
        { status: 403 }
      );
    }

    return NextResponse.json(standardResponse(true, data, 200));
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await assertSupabaseUser(request);
    const profile = await getProfileByUserId(user.id);
    const payload = updateSchema.parse(await request.json());

    const { data, error } = await adminClient
      .from("projects")
      .select("user_id")
      .eq("id", params.id)
      .maybeSingle<{ user_id: string }>();

    if (error) throw new Error(error.message);
    if (!data) {
      return NextResponse.json(
        standardResponse(false, undefined, 404, "Project not found"),
        { status: 404 }
      );
    }

    const isOwner = data.user_id === user.id;
    const isExpert = profile?.role === "expert";
    if (!isOwner && !isExpert) {
      return NextResponse.json(
        standardResponse(false, undefined, 403, "Not authorized"),
        { status: 403 }
      );
    }

    const updatePayload = {
      ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
      ...(payload.tags !== undefined ? { tags: payload.tags } : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error: updateError } = await adminClient
      .from("projects")
      .update(updatePayload)
      .eq("id", params.id)
      .select("*")
      .maybeSingle<Record<string, unknown>>();

    if (updateError) throw new Error(updateError.message);

    return NextResponse.json(standardResponse(true, updated, 200));
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
