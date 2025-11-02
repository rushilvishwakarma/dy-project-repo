import { adminClient } from "./supabase/admin";

export async function getGithubTokenForUser(userId: string) {
  const { data, error } = await adminClient
    .from("user_tokens")
    .select("github_token")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.github_token) {
    throw new Error("GitHub token not found for user");
  }

  return data.github_token as string;
}
