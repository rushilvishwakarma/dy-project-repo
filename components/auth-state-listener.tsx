"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * AuthStateListener monitors Supabase auth state changes client-side.
 * This helps catch OAuth sign-ins and ensures the client session stays in sync.
 */
export function AuthStateListener() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth state change:", event);

      // Handle successful sign-in
      if (event === "SIGNED_IN" && session) {
        // Refresh the page to update server components
        router.refresh();
      }

      // Handle sign-out
      if (event === "SIGNED_OUT") {
        router.push("/");
        router.refresh();
      }

      // Handle token refresh
      if (event === "TOKEN_REFRESHED") {
        router.refresh();
      }
    });

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return null;
}
