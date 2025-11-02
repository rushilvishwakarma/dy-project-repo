import { notFound, redirect } from "next/navigation";
import { ProjectDetailShell } from "@/components/projects/project-detail-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getProfileByUserId } from "@/lib/profiles";
import { Profile } from "@/types";

export default async function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createServerSupabaseClient();
  // Authenticate the request by verifying the JWT with Supabase Auth.
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/");
  }

  if (!params.id) {
    notFound();
  }

  const profile = (await getProfileByUserId(user.id)) ?? ({
    id: user.id,
    role: "developer",
  } satisfies Profile);

  return (
    <main className="container mx-auto max-w-5xl space-y-10 px-4 py-10">
      <ProjectDetailShell projectId={params.id} profile={profile} />
    </main>
  );
}
