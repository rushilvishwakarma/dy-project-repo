"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function CallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Linking your GitHub account...");

  useEffect(() => {
    const supabase = createClient();
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const providerToken =
      params.get("provider_token") ?? params.get("provider_access_token") ?? undefined;

    async function storeTokens() {
      if (!accessToken || !refreshToken) {
        setMessage("Missing Supabase session token. Please retry the login flow.");
        toast.error("Missing Supabase session token");
        return;
      }
      if (!providerToken) {
        setMessage("Missing GitHub provider token. Reconnect your GitHub account.");
        toast.error("GitHub access was not granted");
        return;
      }

      try {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        window.history.replaceState({}, document.title, window.location.pathname);
        const response = await fetch("/api/auth/store-github-token", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ provider_token: providerToken }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Failed to store GitHub token");
        }

        setMessage("GitHub account connected successfully. Redirecting...");
        toast.success("GitHub account connected");
        router.replace("/dashboard");
      } catch (error) {
        const err = error as Error;
        setMessage(err.message || "Unexpected error during GitHub linking.");
        toast.error(err.message);
      }
    }

    storeTokens();
  }, [router]);

  return (
    <main className="flex min-h-[calc(100vh-6rem)] flex-col items-center justify-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </main>
  );
}
