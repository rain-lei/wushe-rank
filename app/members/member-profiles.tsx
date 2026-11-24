"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { profileTemplate, type MemberProfiles } from "@/lib/member-profile";
import type { TagService } from "@/lib/member-tags";

const ProfileContext = createContext<{
  profiles: MemberProfiles; status: "loading" | "ready" | "error"; retry: () => void;
}>({ profiles: {}, status: "loading", retry: () => {} });

export function MemberProfilesProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [profiles, setProfiles] = useState<MemberProfiles>({});
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let pending = false;
    async function refresh() {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const response = await fetch("/api/member-profiles", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw Error();
        const value: MemberProfiles = await response.json();
        if (!controller.signal.aborted) { setProfiles(value); setStatus("ready"); }
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      } finally { pending = false; }
    }
    void refresh();
    const timer = window.setInterval(refresh, 180_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [enabled, attempt]);
  return <ProfileContext.Provider value={{ profiles, status, retry: () => setAttempt(n => n + 1) }}>{children}</ProfileContext.Provider>;
}

export function useProfiles() { return useContext(ProfileContext); }

export function MemberSignature({ id, service }: { id: string; service: TagService }) {
  const { profiles, status, retry } = useProfiles();
  if (service.kind !== "github") return null;
  const profile = profiles[id];
  const root = "https://github.com/" + service.repo;
  const branch = service.branch.split("/").map(encodeURIComponent).join("/");
  const file = "profiles/" + id + ".md";
  const proposal = profile ? root + "/edit/" + branch + "/" + file :
    root + "/new/" + branch + "?" + new URLSearchParams({ filename: file, value: profileTemplate(id) });
  return <section className="member-signature" aria-labelledby="signature-title">
    <h2 id="signature-title">个性签名</h2>
    {profile?.signature ? <p className="signature-text">{profile.signature}</p> :
      status !== "error" && <p className="signature-empty">{status === "loading" ? "正在读取…" : "还没有写签名。"}</p>}
    {status === "error" && <p className="tag-hint" role="status">暂时无法读取群友资料。<button className="tag-retry" onClick={retry}>重试</button></p>}
    <details className="profile-edit">
      <summary>编辑签名和头像</summary>
      <p>在 Markdown 正文写签名。换头像时，把图片和这行 Markdown 提交到同一个 PR，合并后生效。</p>
      <code>{"![头像](avatars/" + id + ".png)"}</code>
      <div className="profile-links">
        {status === "ready" && <a className="thread-primary" href={proposal} target="_blank" rel="noopener noreferrer">在 GitHub {profile ? "编辑" : "创建"} {id} 号资料</a>}
        <a href={root + "/blob/" + branch + "/profiles/README.md"} target="_blank" rel="noopener noreferrer">填写说明</a>
      </div>
    </details>
  </section>;
}
