import type { Metadata } from "next";
import { getTagService } from "@/lib/member-tags-server";
import { MemberProfilesProvider } from "./members/member-profiles";
import "./globals.css";
export const metadata: Metadata = { title: "五舍群友榜 · 五舍投票站", description: "按头像找群友，查看今日榜和累计榜。每天可投给三位不同的群友。", icons: { icon: "/favicon.svg" } };
export default function Layout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="zh-CN"><body><MemberProfilesProvider enabled={getTagService().kind === "github"}>{children}</MemberProfilesProvider></body></html>;
}
