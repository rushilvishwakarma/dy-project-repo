import { NextRequest, NextResponse } from "next/server";
import { assertSupabaseUser } from "@/lib/auth";
import { standardResponse } from "@/lib/response";
import { adminClient } from "@/lib/supabase/admin";
import { getProfileByUserId } from "@/lib/profiles";

async function ensureAccess(projectId: string, userId: string) {
  const profile = await getProfileByUserId(userId);
  const { data, error } = await adminClient
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .maybeSingle<{ id: string; user_id: string }>();

  if (error) throw new Error(error.message);
  if (!data) {
    return { project: null, profile } as const;
  }

  const isOwner = data.user_id === userId;
  const isExpert = profile?.role === "expert";
  if (!isOwner && !isExpert) {
    throw Object.assign(new Error("Not authorized"), { status: 403 });
  }

  return { project: data, profile } as const;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await assertSupabaseUser(request);
    const { project } = await ensureAccess(params.id, user.id);
    if (!project) {
      return NextResponse.json(
        standardResponse(false, undefined, 404, "Project not found"),
        { status: 404 }
      );
    }

    const { data, error } = await adminClient
      .from("project_documents")
      .select("id, file_name, file_url, content_type, size, created_at")
      .eq("project_id", params.id)
      .order("created_at", { ascending: false });

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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await assertSupabaseUser(request);
    const { project } = await ensureAccess(params.id, user.id);
    if (!project) {
      return NextResponse.json(
        standardResponse(false, undefined, 404, "Project not found"),
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        standardResponse(false, undefined, 400, "No files provided"),
        { status: 400 }
      );
    }

    const bucket = adminClient.storage.from("project_documents");
    const uploads = [];

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const filePath = `${project.user_id}/${params.id}/${Date.now()}-${file.name}`;

      const { data: uploadData, error: uploadError } = await bucket.upload(
        filePath,
        arrayBuffer,
        {
          contentType: file.type,
          upsert: true,
        }
      );

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: publicData } = bucket.getPublicUrl(filePath);
      const fileUrl = publicData?.publicUrl;

      const { data: docRecord, error: docError } = await adminClient
        .from("project_documents")
        .insert({
          project_id: params.id,
          file_name: file.name,
          file_path: uploadData?.path ?? filePath,
          file_url: fileUrl,
          content_type: file.type,
          size: file.size,
        })
        .select("*")
        .single();

      if (docError) {
        throw new Error(docError.message);
      }

      uploads.push(docRecord);
    }

    return NextResponse.json(standardResponse(true, uploads, 201), {
      status: 201,
    });
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
