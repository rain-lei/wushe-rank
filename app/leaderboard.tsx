"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight, CircleHelp, Clock3, MessageCircle, Plus, Search, Tags, Ticket, X } from "lucide-react";
import Mark from "./brand-mark";
import MemberAvatar from "./member-avatar";
import { useMemberTags } from "./members/use-member-tags";
import { idText } from "@/lib/member-display";
import type { TagService } from "@/lib/member-tags";
import { dailyVoteLimit, memberCount } from "@/lib/voting-common";
import { nextBeijingMidnight } from "@/lib/voting-day";

type Period = "total" | "today";
type Board = {
  day: string;
  members: number;
  counts: { candidate: number; total: number; today: number }[];
  myVotes: number[];
};
type Modal = { kind: "vote"; id: number } | { kind: "rules" } | { kind: "wallet" };

const pageSize = 30;
const dateFormat = new Intl.DateTimeFormat("zh-CN", {
  month: "long", day: "numeric", weekday: "long", timeZone: "Asia/Shanghai",
});
const periods: Period[] = ["total", "today"];

function DailyTicket({ board, onOpen }: { board: Board | null; onOpen: () => void }) {
  const remaining = dailyVoteLimit - (board?.myVotes?.length ?? 0);
  return (
    <button className="ticket-wrap" type="button" onClick={onOpen} aria-label="查看我的选票">
      <span className="daily-ticket">
        <span className="ticket-main">
          <span className="ticket-label"><Ticket size={17}/>我的今日选票</span>
          <strong className="ticket-value">
            {board ? <>剩余 <b>{remaining}</b> 票</> : "读取中…"}
          </strong>
          <span className="ticket-note"><Clock3 size={13}/>北京时间 00:00 更新</span>
        </span>
        <span className="ticket-stub" aria-hidden="true">
          <span className="ticket-arrow"><ArrowUpRight size={23}/></span>
          <span className="barcode"/>
          <span className="ticket-serial">{board?.day.replaceAll("-", ".") ?? "····.··.··"}</span>
        </span>
      </span>
    </button>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  return (
    <dialog ref={ref} aria-labelledby="dialog-title" onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}>
      <div className="dialog-heading">
        <h2 id="dialog-title">{title}</h2>
        <button type="button" className="icon-button" aria-label="关闭" onClick={onClose}><X size={19}/></button>
      </div>
      {children}
    </dialog>
  );
}

async function castBrowserVote(candidate: number) {
  const headers = { "Content-Type": "application/json" };
  async function send() {
    const session = await fetch("/api/session", { method: "POST", headers, body: "{}" });
    if (!session.ok) return session;
    return fetch("/api/vote", { method: "POST", headers, body: JSON.stringify({ candidate }) });
  }
  // Serialize first-time cookie creation when two tabs confirm a ballot together.
  return navigator.locks ? navigator.locks.request("wushe-vote", send) : send();
}

export default function Leaderboard({ commentsAvailable, tagMode, viewSuffix }: { commentsAvailable: boolean; tagMode: TagService["kind"]; viewSuffix: string }) {
  const { tags, local } = useMemberTags(tagMode);
  const profilesAvailable = commentsAvailable || tagMode === "github" || tagMode === "visitor" || local;
  const [board, setBoard] = useState<Board | null>(null);
  const [period, setPeriod] = useState<Period>("total");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState<Modal | null>(null);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const latest = useRef(0);
  const listTop = useRef<HTMLElement>(null);
  const day = board?.day;
  const members = board?.members ?? memberCount;
  const myVotes = board?.myVotes ?? [];
  const remaining = dailyVoteLimit - myVotes.length;

  const refresh = useCallback(async () => {
    const sequence = ++latest.current;
    try {
      const response = await fetch("/api/board", { cache: "no-store" });
      if (!response.ok) throw Error();
      const fresh: Board = await response.json();
      if (sequence === latest.current) {
        setBoard(fresh);
        setLoadError(false);
      }
    } catch {
      if (sequence === latest.current) setLoadError(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const check = () => { if (document.visibilityState === "visible") refresh(); };
    const tick = window.setInterval(check, 25000);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", check);
    };
  }, [refresh]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!day) return;
    const timer = window.setTimeout(refresh, Math.max(0, nextBeijingMidnight(day) - Date.now()) + 100);
    return () => window.clearTimeout(timer);
  }, [day, refresh]);

  const ranking = useMemo(() => {
    const votes = new Map(board?.counts.map(row => [row.candidate, row[period]]));
    const items = Array.from({ length: members }, (_, i) => ({ id: i + 1, votes: votes.get(i + 1) ?? 0, rank: 0 }));
    items.sort((a, b) => b.votes - a.votes || a.id - b.id);
    let rank = 0;
    items.forEach((item, i) => {
      if (i === 0 || item.votes !== items[i - 1].votes) rank = i + 1;
      item.rank = item.votes > 0 ? rank : 0;
    });
    return items;
  }, [board, members, period]);
  const todayTotal = board?.counts.reduce((sum, row) => sum + row.today, 0);
  const periodTotal = board?.counts.reduce((sum, row) => sum + row[period], 0);
  const query = search.trim();
  const number = query.replace(/^#/, "").replace(/^群友\s*/, "").replace(/号$/, "").trim();
  const filtered = ranking.filter(row => !query || (number && idText(row.id).includes(number)));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * pageSize, (current + 1) * pageSize);

  function changePage(next: number) {
    setPage(next);
    if (listTop.current && listTop.current.getBoundingClientRect().top < 0) {
      listTop.current.scrollIntoView({ block: "start" });
    }
  }
  function open(data: Modal) { setError(""); setModal(data); }
  function close() { if (!busy) setModal(null); }

  async function submit() {
    if (modal?.kind !== "vote" || busy || !board || remaining === 0 || myVotes.includes(modal.id)) return;
    setBusy(true);
    setError("");
    try {
      const response = await castBrowserVote(modal.id);
      if (!response.ok && response.status !== 409) {
        const failure = await response.json() as { error?: string };
        setError(failure.error ?? "提交失败，请重试。");
        return;
      }
      const result = await response.json() as { day: string; myVotes: number[]; error?: string };
      setBoard(previous => previous?.day === result.day ? { ...previous, myVotes: result.myVotes } : previous);
      if (response.ok) {
        setNotice("已投给群友 " + idText(modal.id) + "，今天还剩 " + (dailyVoteLimit - result.myVotes.length) + " 票");
        setModal(null);
      } else {
        setError(result.error ?? "今天的选票已更新。");
        setModal({ kind: "wallet" });
      }
      await refresh();
    } catch {
      setError("暂时连不上投票站，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }
  const target = modal?.kind === "vote" && board && remaining > 0 && !myVotes.includes(modal.id) ? modal.id : null;
  const dialogTitle = modal?.kind === "rules" ? "投票规则" : target === null ? "我的选票" : "投给群友 " + idText(target);

  return <>
    <header className="site-header" id="top">
      <div className="shell topbar">
        <a className="brand" href="#top" aria-label="五舍投票站首页"><Mark/>五舍投票站</a>
        <button className="rules-link" onClick={() => open({ kind: "rules" })}><CircleHelp size={17}/>投票规则</button>
      </div>
    </header>
    <main className="shell">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="date-line"><CalendarDays size={15}/>{day ? <time dateTime={day}>{dateFormat.format(new Date(day + "T12:00:00+08:00"))}</time> : "每日投票"}</div>
          <h1 id="hero-title">五舍群友榜<span aria-hidden="true" className="title-dot"/></h1>
          <p>每天有 {dailyVoteLimit} 票，同一位群友当天只能投一次。</p>
          <div className="hero-stats">
            <span className="avatar-stack" aria-hidden="true">{[24, 225, 126].map(id => <MemberAvatar key={id} member={id} alt=""/>)}</span>
            <span><b>{members}</b> 位群友</span><i aria-hidden="true"/><span>今日已投 <b>{todayTotal ?? "—"}</b> 票</span>
          </div>
        </div>
        <DailyTicket board={board} onOpen={() => open({ kind: "wallet" })}/>
      </section>

      <section id="rankings" className="rankings" ref={listTop} aria-label="群友排行榜">
        <div className="board-toolbar">
          <div className="tabs" role="group" aria-label="统计范围">
            {periods.map(p => <button key={p} aria-pressed={period === p} onClick={() => { setPeriod(p); setPage(0); }}>
              {p === "total" ? "累计榜" : "今日榜"}
            </button>)}
          </div>
          <label className="search">
            <Search size={17}/><input type="search" aria-label="搜索群友编号" placeholder="搜索群友编号" value={search}
              onChange={event => { setSearch(event.target.value); setPage(0); }}/>
          </label>
        </div>
        <div className="list-summary">
          <h2>{query ? "找到 " + filtered.length + " 位群友" : "全部群友"}</h2>
          <span>{period === "today" ? "今日" : "累计"} {periodTotal ?? "—"} 票<span className="mid-dot">·</span>按票数排序</span>
        </div>
        {loadError && <div className="load-warning" role="alert">暂时无法更新票数。<button onClick={refresh}>重新加载</button></div>}
        {filtered.length === 0 ? <div className="empty">
          <Search size={26}/><h3>没有找到这个编号</h3><p>输入 001 至 {members} 之间的群友编号。</p>
          <button className="secondary" onClick={() => { setSearch(""); setPage(0); }}>查看全部群友</button>
        </div> : <ol className="members" aria-label="群友排名">
          {visible.map(row => {
            const mine = myVotes.includes(row.id);
            const id = idText(row.id);
            const profile = "/members/" + id + viewSuffix;
            const labels = tags[id] ?? [];
            return <li key={row.id} className={"member" + (mine ? " my-choice" : "")}>
              <span className={"rank" + (row.rank > 0 && row.rank <= 3 ? " leading" : "")} aria-label={row.rank ? "第 " + row.rank + " 名" : "待上榜"}>
                {row.rank ? String(row.rank).padStart(2, "0") : "—"}
              </span>
              <MemberAvatar className="member-avatar" member={row.id} width="58" height="58"/>
              <div className="member-info"><h3>{profilesAvailable
                ? <a href={profile}>群友 <b>{id}</b></a> : <>群友 <b>{id}</b></>}</h3><p>{board ? row.votes : "—"} 票</p></div>
              {profilesAvailable && <a className="comment-link" href={profile + (commentsAvailable ? "#comments" : "#impressions-title")} aria-label={"查看群友 " + id + (commentsAvailable ? " 的评论" : " 的标签")}>
                {commentsAvailable ? <MessageCircle size={16}/> : <Tags size={16}/>}<span>{commentsAvailable ? "评论" : "标签"}</span>
              </a>}
              <button className={"vote-button" + (mine ? " cast" : "")} type="button"
                aria-label={mine ? "已投给群友 " + id : "给群友 " + id + " 投票"}
                disabled={!board || busy || (remaining === 0 && !mine)}
                onClick={() => open(mine ? { kind: "wallet" } : { kind: "vote", id: row.id })}>
                {mine ? <Check size={15}/> : <Plus size={15}/>} {mine ? "已投" : "投票"}
              </button>
              {labels.length > 0 && <a className="board-tags" href={profile + "#impressions-title"}>
                {labels.map(label => <span key={label}>#{label}</span>)}
              </a>}
            </li>;
          })}
        </ol>}
        {filtered.length > 0 && <div className="pagination">
          <span>显示 {current * pageSize + 1}–{Math.min((current + 1) * pageSize, filtered.length)} 位</span>
          <div>
            <button aria-label="上一页" disabled={current === 0} onClick={() => changePage(current - 1)}><ChevronLeft size={19}/></button>
            <b aria-label={"第 " + (current + 1) + " 页，共 " + pages + " 页"}>{current + 1} <em>/</em> {pages}</b>
            <button aria-label="下一页" disabled={current + 1 >= pages} onClick={() => changePage(current + 1)}><ChevronRight size={19}/></button>
          </div>
        </div>}
      </section>
      <footer><span><Mark/>五舍投票站</span><a href="#top">回到顶部 ↑</a></footer>
    </main>
    {notice && <div className="toast" role="status"><Check size={17}/>{notice}</div>}
    {modal && <Dialog title={dialogTitle} onClose={close}>
      {modal.kind === "rules" ? <>
        <dl className="rules-list">
          <dt>每天最多投给 {dailyVoteLimit} 位群友</dt><dd>同一浏览器每天有 {dailyVoteLimit} 票，可以分开投。每位群友当天限投一次，确认后无法改票。</dd>
          <dt>北京时间零点恢复</dt><dd>投票 Cookie 用来识别这个浏览器，到下一个北京时间零点失效。点击首页的选票可以查看今天支持过的群友。</dd>
          <dt>排名与并列</dt><dd>今日榜统计当天的票数，累计榜保留历次投票。同票并列，零票群友按编号排列。</dd>
        </dl>
        <button className="primary" onClick={close}>知道了</button>
      </> : !board ? <p className="dialog-intro">{loadError ? "暂时无法读取选票，请稍后重试。" : "正在读取选票…"}</p> :
        target !== null ? <form onSubmit={event => { event.preventDefault(); submit(); }}>
          <div className="chosen-member"><MemberAvatar member={target}/><div><b>群友 {idText(target)}</b><p>投出后今天还剩 {remaining - 1} 票。</p></div></div>
          <p className="ballot-notice">投票会保存一个 Cookie，用于限制这个浏览器每天最多投给 {dailyVoteLimit} 位不同的群友。它在下一个北京时间零点到期。</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="dialog-actions"><button type="button" className="secondary" disabled={busy} onClick={close}>再看看</button><button className="primary" disabled={busy} type="submit">{busy ? "提交中…" : "同意并投票"}</button></div>
        </form> : <>
          <p className="dialog-intro">今天还剩 <b>{remaining}</b> 票。{myVotes.length ? "你今天已支持的群友" : "每票可以支持一位不同的群友。"}</p>
          {myVotes.length > 0 && <ul className="wallet-choices">{myVotes.map(id =>
            <li key={id}><MemberAvatar member={id}/><span>群友 {idText(id)}</span><Check size={17}/></li>
          )}</ul>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary" type="button" onClick={close}>返回排行榜</button>
        </>}
    </Dialog>}
  </>;
}
