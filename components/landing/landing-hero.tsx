"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function LandingHero() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login");
      if (!response.ok) {
        throw new Error("Failed to generate login URL");
      }
      const payload = await response.json();
      if (!payload?.success || !payload?.data?.auth_url) {
        throw new Error(payload?.error ?? "Unexpected auth response");
      }
      window.location.href = payload.data.auth_url as string;
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col items-center gap-10 py-24 text-center">
      <div className="flex flex-col items-center gap-4">
        <span className="rounded-full border border-border bg-muted px-4 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Project Repository
        </span>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Showcase and evaluate GitHub projects with Supabase-powered insights.
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
          Students import their repositories with one click. Teachers review curated portfolios ranked by GitHub signals and enriched with documentation, certificates, and more.
        </p>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row">
        <Button onClick={handleLogin} disabled={loading} className="min-w-[220px]">
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Redirecting to GitHub
            </span>
          ) : (
            "Continue with GitHub"
          )}
        </Button>
      </div>
    </section>
  );
}
