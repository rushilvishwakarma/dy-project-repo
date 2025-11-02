"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Handles OAuth tokens that arrive in the URL hash on any page
 * This fixes the issue where Supabase redirects to "/" instead of "/auth/callback"
 */
export function OAuthHandler() {
  const router = useRouter();

  useEffect(() => {
    const handleOAuthTokens = async () => {
      // Only run on client side
      if (typeof window === "undefined") return;

      // Check if we have OAuth tokens in the URL hash
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const providerToken = hashParams.get("provider_token");

      // If we have tokens, process them
      if (accessToken && refreshToken) {
        console.log("OAuth tokens detected, processing...");
        
        const supabase = createClient();

        try {
          // Set the session with the tokens
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error("Error setting session:", error);
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

          // Clean up the URL (remove hash params)
          window.history.replaceState(null, "", window.location.pathname + window.location.search);

          // Redirect to dashboard
          console.log("Session established, redirecting to dashboard...");
          router.push("/dashboard");
        } catch (err) {
          console.error("Error processing OAuth callback:", err);
        }
      }
    };

    handleOAuthTokens();
  }, [router]);

  return null; // This component doesn't render anything
}
