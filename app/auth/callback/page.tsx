"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = createClient();
        
        // Check if we have hash parameters (implicit flow)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const providerToken = hashParams.get("provider_token");
        
        if (accessToken && refreshToken) {
          // Set the session with the tokens from the hash
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error("Error setting session:", error);
            setErrorMessage(error.message);
            setStatus("error");
            return;
          }

          // Store the GitHub provider token if available
          if (providerToken) {
            try {
              const response = await fetch("/api/auth/store-github-token", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ provider_token: providerToken }),
              });

              if (!response.ok) {
                console.error("Failed to store GitHub token");
              }
            } catch (err) {
              console.error("Error storing GitHub token:", err);
            }
          }

          setStatus("success");
          // Redirect to dashboard after successful authentication
          router.push("/dashboard");
          return;
        }

        // If no hash params, check for error in query params
        const searchParams = new URLSearchParams(window.location.search);
        const error = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");

        if (error) {
          setErrorMessage(errorDescription || error);
          setStatus("error");
          return;
        }

        // No tokens or error found
        setErrorMessage("No authentication tokens found");
        setStatus("error");
      } catch (err) {
        console.error("Callback error:", err);
        setErrorMessage(err instanceof Error ? err.message : "Unknown error");
        setStatus("error");
      }
    };

    handleCallback();
  }, [router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="text-sm text-muted-foreground">Completing authentication...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md text-center">
          <h1 className="mb-2 text-2xl font-bold">Authentication Error</h1>
          <p className="mb-4 text-muted-foreground">{errorMessage}</p>
          <a href="/" className="text-primary hover:underline">
            Return to home
          </a>
        </div>
      </div>
    );
  }

  return null;
}
