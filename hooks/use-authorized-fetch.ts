"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export function useAuthorizedFetch() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setAccessToken(session?.access_token ?? null);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth]);

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!accessToken) {
      throw new Error("User session not available");
    }

    const headers: Record<string, string> = normalizeHeaders(init?.headers);

    if (!(init?.body instanceof FormData) && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    headers["Authorization"] = `Bearer ${accessToken}`;

    const response = await fetch(input, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Request failed with ${response.status}`);
    }

    return response;
  };
}

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return { ...headers } as Record<string, string>;
}
