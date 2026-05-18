export function stripHtml(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;script.*?&gt;.*?&lt;\/script&gt;/gi, "")
    .trim();
}

export function sanitizeString(input: string | null | undefined, maxLength = 2000): string {
  if (!input) return "";
  const stripped = stripHtml(input);
  return stripped.slice(0, maxLength);
}

export function escapeHtml(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
