import { getTagService } from "@/lib/member-tags-server";
import { readMergedProfiles } from "@/lib/member-profiles-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const repo = getTagService();
  if (repo.kind !== "github") return new Response(null, { status: 404 });
  try {
    const { profiles } = await readMergedProfiles(repo);
    return Response.json(profiles, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "暂时无法读取群友资料。" }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "15" } });
  }
}
