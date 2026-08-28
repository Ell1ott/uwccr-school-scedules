export function errorMessage(error: unknown, fallback = "unknown"): string {
  return error instanceof Error ? error.message : fallback;
}
