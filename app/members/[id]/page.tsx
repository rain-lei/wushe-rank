import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import Mark from "@/app/brand-mark";
import MemberAvatar from "@/app/member-avatar";
import { communityView, type ViewQuery } from "@/lib/community-view";
import { idText } from "@/lib/member-display";
import { validMember } from "@/lib/voting-common";
import CommentThread from "../comment-thread";
import ImpressionTags from "../impression-tags";
import { MemberSignature } from "../member-profiles";
import "../comments.css";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }>; searchParams: ViewQuery };

function memberNumber(value: string) {
  const id = Number(value);
  if (!validMember(id) || idText(id) !== value) notFound();
  return id;
}

export async function generateMetadata({ params }: Props) {
  const id = memberNumber((await params).id);
  return { title: "群友 " + idText(id) + " 的主页 · 五舍群友榜" };
}

export default async function MemberPage({ params, searchParams }: Props) {
  const id = memberNumber((await params).id);
  const { comments, tags, suffix } = await communityView(searchParams);
  return <>
    <header className="site-header"><div className="shell topbar">
      <a href={"/" + suffix} className="brand"><Mark/>五舍投票站</a>
      <a href={"/" + suffix + "#rankings"} className="rules-link"><ArrowLeft size={16}/>返回榜单</a>
    </div></header>
    <main className="discussion-shell">
      <header className="thread-identity">
        <MemberAvatar member={id} width="76" height="76"/>
        <div><p>群友主页</p><h1>群友 <b>{idText(id)}</b></h1></div>
      </header>
      <MemberSignature id={idText(id)} service={tags}/>
      <ImpressionTags key={"tags-" + id} id={idText(id)} service={tags}/>
      <div id="comments"><CommentThread key={id} member={id} service={comments}/></div>
    </main>
  </>;
}
