export const env = {
  // Empty string = same origin (works for local Windows deployment where
  // FastAPI serves both API and static frontend on port 8000).
  // For hosted deployments, set NEXT_PUBLIC_API_BASE_URL at build time.
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
};
