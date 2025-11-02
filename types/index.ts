export type Role = "developer" | "expert";

export type Profile = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  role?: Role | null;
  avatar_url?: string | null;
};

export type GithubRepo = {
  id: number;
  name: string;
  html_url: string;
  description?: string | null;
  private: boolean;
  fork: boolean;
  language?: string | null;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  owner?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  pushed_at?: string | null;
  default_branch?: string | null;
  open_issues_count?: number | null;
  visibility?: string | null;
};

export type GithubUser = {
  github_id: number;
  username: string;
  email?: string | null;
  avatar_url?: string | null;
  html_url?: string | null;
  updated_at?: string | null;
};

export type GithubActivityItem = {
  id: string;
  type?: string;
  repo?: string;
  created_at?: string;
};

export type GithubContributionDay = {
  date: string;
  count: number;
};

export type GithubContributionSummary = {
  total_contributions: number;
  contributions: GithubContributionDay[];
};

export type ProjectDocument = {
  id: string;
  file_name: string;
  file_url?: string | null;
  content_type?: string | null;
  size?: number | null;
  created_at?: string | null;
};

export type Project = {
  id: string;
  user_id: string;
  github_repo_id: number;
  repository_full_name: string;
  name: string;
  description?: string | null;
  html_url?: string | null;
  private?: boolean;
  fork?: boolean;
  language?: string | null;
  stars?: number;
  forks?: number;
  watchers?: number;
  open_issues?: number;
  visibility?: string | null;
  owner_username?: string | null;
  default_branch?: string | null;
  pushed_at?: string | null;
  created_at_github?: string | null;
  updated_at_github?: string | null;
  last_synced_at?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  status?: "draft" | "in_review" | "published" | null;
  documents?: ProjectDocument[];
};

export type ExpertProjectGroup = {
  owner_id: string;
  owner: Profile | null;
  projects: Project[];
};
