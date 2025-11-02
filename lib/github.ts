import { Buffer } from "node:buffer";

const GITHUB_API = "https://api.github.com";

export interface GithubApiUser {
  id: number;
  login: string;
  email: string | null;
  avatar_url: string | null;
  html_url: string;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface GithubApiRepositoryOwner {
  login: string;
  html_url?: string;
  [key: string]: unknown;
}

export interface GithubApiRepository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  private: boolean;
  fork: boolean;
  language: string | null;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  owner: GithubApiRepositoryOwner | null;
  created_at: string | null;
  updated_at: string | null;
  pushed_at: string | null;
  default_branch: string | null;
  open_issues_count: number | null;
  visibility?: string | null;
  [key: string]: unknown;
}

export interface GithubApiEvent {
  id: string;
  type?: string;
  repo?: { name?: string };
  created_at?: string;
  [key: string]: unknown;
}

export interface GithubContributionDayApi {
  date: string;
  contributionCount: number;
}

export interface GithubContributionWeekApi {
  contributionDays: GithubContributionDayApi[];
}

export interface GithubContributionCalendarApi {
  totalContributions: number;
  weeks: GithubContributionWeekApi[];
}

export interface GithubContributionsResponse {
  data?: {
    viewer?: {
      contributionsCollection?: {
        contributionCalendar?: GithubContributionCalendarApi;
      } | null;
    } | null;
  } | null;
}

export interface GithubReadmeResponse {
  content: string;
  encoding?: BufferEncoding;
}

export interface GithubFileContent {
  type: "file";
  encoding?: string;
  size?: number;
  name: string;
  path: string;
  content?: string;
  download_url?: string;
  [key: string]: unknown;
}

export interface GithubDirectoryItem {
  type: "dir";
  name: string;
  path: string;
  download_url?: string | null;
  [key: string]: unknown;
}

export type GithubRepositoryContent = GithubFileContent | GithubDirectoryItem[];

async function githubRequest<T>(
  path: string,
  token: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `GitHub request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchGithubUser(token: string): Promise<GithubApiUser> {
  return githubRequest<GithubApiUser>("/user", token);
}

export async function fetchGithubUserRepos(
  token: string
): Promise<GithubApiRepository[]> {
  return githubRequest<GithubApiRepository[]>(
    "/user/repos?per_page=100&sort=updated",
    token
  );
}

export async function fetchRepoByFullName(
  token: string,
  fullName: string
): Promise<GithubApiRepository> {
  return githubRequest<GithubApiRepository>(`/repos/${fullName}`, token);
}

export async function fetchGithubProfileRepo(
  token: string,
  username: string
): Promise<{ repo: GithubApiRepository; readme: string | null }> {
  const repo = await githubRequest<GithubApiRepository>(
    `/repos/${username}/${username}`,
    token
  );

  let readme: string | null = null;
  try {
    const readmeResponse = await githubRequest<GithubReadmeResponse>(
      `/repos/${username}/${username}/readme`,
      token
    );
    if (readmeResponse?.content) {
      const encoding = readmeResponse.encoding ?? "base64";
      readme = Buffer.from(readmeResponse.content, encoding).toString("utf-8");
    }
  } catch {
    readme = null;
  }

  return { repo, readme };
}

export async function fetchGithubActivity(
  token: string,
  username: string
): Promise<GithubApiEvent[]> {
  return githubRequest<GithubApiEvent[]>(`/users/${username}/events`, token);
}

export async function fetchGithubContributions(
  token: string
): Promise<GithubContributionsResponse> {
  const query = {
    query: `
      {
        viewer {
          contributionsCollection {
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  date
                  contributionCount
                }
              }
            }
          }
        }
      }
    `,
  };

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
    },
    body: JSON.stringify(query),
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `GitHub GraphQL failed with ${response.status}`);
  }

  return response.json() as Promise<GithubContributionsResponse>;
}

export async function fetchRepoContent(
  token: string,
  owner: string,
  repo: string,
  path: string
): Promise<GithubRepositoryContent> {
  return githubRequest<GithubRepositoryContent>(
    `/repos/${owner}/${repo}/contents/${path}`,
    token
  );
}
