import type { TagService } from "./member-tags";
import { avatarByteLimit, parseProfileMarkdown, profileByteLimit, type MemberProfile, type MemberProfiles } from "./member-profile";
import { validMember } from "./voting-common";

type Repository = Extract<TagService, { kind: "github" }>;
type Entry = { path: string; type: string; mode: string; sha: string; size: number };
type Snapshot = {
  repo: string;
  revision: string;
  profiles: MemberProfiles;
  sources: Map<string, { sha: string; parsed: MemberProfile }>;
  images: Map<string, { url: string; sha: string; type: string }>;
};

let last: Snapshot | undefined;
let cached: { key: string; until: number; result: Promise<Snapshot> } | undefined;

async function github(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": "wushe-rank" }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw Error("暂时无法读取仓库资料。");
  return res;
}

async function load({ repo, branch }: Repository): Promise<Snapshot> {
  const base = "https://api.github.com/repos/" + repo;
  const head: { object: { sha: string } } = await (await github(base + "/git/ref/heads/" + branch.split("/").map(encodeURIComponent).join("/"))).json();
  const revision: string = head.object?.sha;
  if (!/^[a-f0-9]{40}$/.test(revision)) throw Error("仓库版本无效。");
  const previous = last?.repo === repo ? last : undefined;
  if (previous?.revision === revision) return previous;

  const tree: { tree: Entry[]; truncated: boolean } = await (await github(base + "/git/trees/" + revision + "?recursive=1")).json();
  if (tree.truncated) throw Error("资料目录不完整。");
  const files = new Map(tree.tree.filter(e => e.path.startsWith("profiles/") && e.type === "blob" && (e.mode === "100644" || e.mode === "100755"))
    .map(e => [e.path, e]));
  const docs = [...files.values()].filter(e => /^profiles\/\d{3}\.md$/.test(e.path));
  const rawBase = "https://raw.githubusercontent.com/" + repo + "/" + revision + "/";
  const next: Snapshot = { repo, revision, profiles: {}, sources: new Map(), images: new Map() };
  async function loadMember(file: Entry) {
    const id = file.path.slice("profiles/".length, -3);
    if (!validMember(Number(id)) || file.size > profileByteLimit) throw Error("资料文件无效。");
    const old = previous?.sources.get(id);
    const parsed = old?.sha === file.sha ? old.parsed : parseProfileMarkdown(id, await (await github(rawBase + file.path)).text());
    next.sources.set(id, { sha: file.sha, parsed });
    let avatar: string | null = null;
    if (parsed.avatar) {
      const image = files.get("profiles/" + parsed.avatar);
      if (!image || image.size <= 0 || image.size > avatarByteLimit) throw Error("头像文件无效。");
      const ext = image.path.split(".").pop();
      const type = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      next.images.set(id, { url: rawBase + image.path, sha: image.sha, type });
      avatar = "/api/member-avatar/" + id + "?v=" + image.sha;
    }
    next.profiles[id] = { signature: parsed.signature, avatar };
  }
  for (let start = 0; start < docs.length; start += 8) {
    await Promise.all(docs.slice(start, start + 8).map(loadMember));
  }
  return next;
}

// Reuse one approved revision across visitors. Only changed Markdown blobs need downloading.
export function readMergedProfiles(config: Repository) {
  const key = config.repo + "@" + config.branch;
  if (cached?.key === key && cached.until > Date.now()) return cached.result;
  const result = load(config).then(snapshot => {
    if (cached?.result === result) last = snapshot;
    return snapshot;
  }).catch(error => {
    if (cached?.result === result) cached.until = Date.now() + 15_000;
    throw error;
  });
  cached = { key, until: Date.now() + 180_000, result };
  return result;
}
