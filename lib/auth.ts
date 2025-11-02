import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

function extractBearerToken(authHeader?: string | null) {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function getTokenFromRequest(req?: NextRequest) {
  if (req) {
    const token = extractBearerToken(req.headers.get("authorization"));
    if (token) return token;
  }

  const headerList = headers() as unknown as {
    get(name: string): string | null | undefined;
  };
  const headerToken = extractBearerToken(headerList.get("authorization"));
  if (headerToken) return headerToken;

  return null;
}

export async function assertSupabaseUser(req?: NextRequest) {
  const accessToken = await getTokenFromRequest(req);
  if (!accessToken) {
    throw new AuthError("Missing Authorization header", 401);
  }

  const { data, error } = await adminClient.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new AuthError(error?.message ?? "Invalid or expired token", 401);
  }

  return data.user;
}
