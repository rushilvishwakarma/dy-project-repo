import { NextRequest, NextResponse } from "next/server";
import { assertSupabaseUser } from "@/lib/auth";
import { standardResponse } from "@/lib/response";

export async function GET(request: NextRequest) {
  try {
    const user = await assertSupabaseUser(request);
    return NextResponse.json(standardResponse(true, { user }, 200));
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
