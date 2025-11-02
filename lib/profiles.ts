import { adminClient } from "./supabase/admin";
import { Role } from "@/types";

export type ProfileRow = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  role?: Role | null;
  avatar_url?: string | null;
};

export async function getProfileByUserId(userId: string) {
  const { data, error } = await adminClient
    .from("profiles")
    .select("id, username, full_name, role, avatar_url")
    .eq("id", userId)
    .maybeSingle<ProfileRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
