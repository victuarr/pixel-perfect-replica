export function supabaseErrorMessage(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const obj = e as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error_description === "string") return obj.error_description;
  }
  return JSON.stringify(e);
}
