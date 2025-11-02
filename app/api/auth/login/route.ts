import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { standardResponse } from "@/lib/response";

export async function GET() {
  try {
    const env = getServerEnv();
    const authUrl = new URL(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/authorize`);
    authUrl.searchParams.set("provider", "github");
    authUrl.searchParams.set("redirect_to", env.REDIRECT_URI);
    authUrl.searchParams.set("scopes", "repo,user:email,read:user,read:org");

    return NextResponse.json(standardResponse(true, { auth_url: authUrl.toString() }, 200));
  } catch (error) {
    return NextResponse.json(
      standardResponse(false, undefined, 500, (error as Error).message),
      { status: 500 }
    );
  }
}
