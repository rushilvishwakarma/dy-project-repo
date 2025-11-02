import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getProfileByUserId } from "@/lib/profiles";
import { Profile } from "@/types";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  // Use getUser() to authenticate the access token server-side. This verifies
  // the token with Supabase Auth instead of trusting stored session data.
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/");
  }

  const profile = (await getProfileByUserId(user.id)) ?? ({
    id: user.id,
    username: user.user_metadata?.user_name ?? user.email ?? undefined,
    role: "developer",
  } satisfies Profile);

  return (
    <main className="container mx-auto max-w-6xl space-y-10 px-4 py-10">
      <DashboardShell profile={profile} />
    </main>
  );
}
