export const memberCount = 318;
export const dailyVoteLimit = 3;
export function validMember(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= memberCount;
}

export function json(body: unknown, status = 200, cookie?: string) {
  const headers = new Headers({ "Cache-Control": "private, no-store", "Vary": "Cookie" });
  if (cookie !== undefined) headers.set("Set-Cookie", cookie);
  return Response.json(body, { status, headers });
}

export function readCookie(req: Request, name: string) {
  const prefix = name + "=";
  return req.headers.get("cookie")?.split(";").map(x => x.trim()).find(x => x.startsWith(prefix))?.slice(prefix.length) ?? "";
}

export function makeCookie(req: Request, name: string, value: string, expiresAt: number) {
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return name + "=" + value + "; Path=/; HttpOnly; SameSite=Lax; Expires=" + new Date(expiresAt).toUTCString() + secure;
}

export function mutationAllowed(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return false;
  return (req.headers.get("content-type") ?? "").split(";")[0].trim() === "application/json";
}

export async function readObject(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await req.json();
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
}

export async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, "0")).join("");
}
