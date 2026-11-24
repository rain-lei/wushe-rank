import { getTagService } from "@/lib/member-tags-server";
import { readMergedProfiles } from "@/lib/member-profiles-server";
import { avatar } from "@/lib/member-display";
import { validMember } from "@/lib/voting-common";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getTagService();
  if (!/^\d{3}$/.test(id) || !validMember(Number(id)) || repo.kind !== "github") return new Response(null, { status: 404 });
  try {
    const snapshot = await readMergedProfiles(repo);
    const image = snapshot.images.get(id);
    if (!image || new URL(req.url).searchParams.get("v") !== image.sha) {
      return new Response(null, { status: 307, headers: {
        Location: snapshot.profiles[id]?.avatar || avatar(Number(id)), "Cache-Control": "no-store",
      } });
    }
    const etag = '"' + image.sha + '"';
    const headers = { "Content-Type": image.type, "Cache-Control": "public, max-age=3600", ETag: etag, "X-Content-Type-Options": "nosniff" };
    if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
    const res = await fetch(image.url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw Error();
    return new Response(res.body, { headers });
  } catch {
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "15" } });
  }
}
