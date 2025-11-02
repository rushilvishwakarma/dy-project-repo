export async function parseStandardResponse<T>(response: Response): Promise<T> {
  const payload = await response.json();
  if (!payload?.success) {
    throw new Error(payload?.error ?? "Unexpected API error");
  }
  return payload.data as T;
}
