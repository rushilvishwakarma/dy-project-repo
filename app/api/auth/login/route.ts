import { NextResponse, NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { standardResponse } from "@/lib/response";

export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url);
    const origin = requestUrl.origin;

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            // Not needed for this route
          },
        },
      }
    );

    // Use Supabase's built-in OAuth with PKCE flow
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${origin}/auth/callback`,
        scopes: "repo user:email read:user read:org",
      },
    });

    if (error) {
      return NextResponse.json(
        standardResponse(false, undefined, 500, error.message),
        { status: 500 }
      );
    }

    if (!data.url) {
      return NextResponse.json(
        standardResponse(false, undefined, 500, "No auth URL generated"),
        { status: 500 }
      );
    }

    return NextResponse.json(standardResponse(true, { auth_url: data.url }, 200));
  } catch (error) {
    return NextResponse.json(
      standardResponse(false, undefined, 500, (error as Error).message),
      { status: 500 }
    );
  }
}
