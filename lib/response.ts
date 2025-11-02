export type StandardResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  status_code: number;
};

export function standardResponse<T>(
  success: boolean,
  data: T | undefined,
  statusCode: number,
  error?: string
): StandardResponse<T> {
  return {
    success,
    data: success ? data : undefined,
    error: success ? undefined : error || "Unexpected error",
    status_code: statusCode,
  };
}
