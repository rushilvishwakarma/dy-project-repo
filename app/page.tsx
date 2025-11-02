import { redirect } from "next/navigation";
import { LandingHero } from "@/components/landing/landing-hero";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  // Prefer getUser() server-side so we verify the JWT with Supabase Auth.
  const { data: { user }, error } = await supabase.auth.getUser();

  if (!error && user) {
    redirect("/dashboard");
  }

  return (
    <main className="container mx-auto flex min-h-[calc(100vh-6rem)] flex-col items-center justify-center px-4">
      <LandingHero />
    </main>
  );
}
