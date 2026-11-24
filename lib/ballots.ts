import { queryVotes } from "#vote-storage";
import { dailyVoteLimit, json, makeCookie, memberCount, mutationAllowed, readCookie, readObject, sha256, validMember } from "./voting-common";
import { beijingDay, nextBeijingMidnight } from "./voting-day";

const cookieName = "wushe_browser";

function browserToken(value: string, day: string) {
  return value.startsWith(day + ".") ? value.slice(day.length + 1) : value;
}

function dailyCookie(req: Request, day: string, token: string) {
  return makeCookie(req, cookieName, day + "." + token, nextBeijingMidnight(day));
}

async function browserDigest(token: string) {
  return /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(token) ? sha256(token) : null;
}

// Previous ballots have nonnegative voter IDs. The negative of a browser's
// permanent registry ID gives it its own key in the same daily vote ledger.
async function browserVoter(token: string) {
  const hash = await browserDigest(token);
  if (!hash) return null;
  const [rows] = await queryVotes(["SELECT -id AS voter FROM browser_voters WHERE token_hash = ?", hash]);
  return rows[0]?.voter ?? null;
}

export async function startBrowserSession(req: Request) {
  if (!mutationAllowed(req)) return json({ error: "请从榜单页面重新投票。" }, 403);
  const day = beijingDay();
  let token = browserToken(readCookie(req, cookieName), day);
  if (await browserVoter(token) === null) {
    token = crypto.randomUUID();
    await queryVotes(["INSERT INTO browser_voters (token_hash) VALUES (?)", await sha256(token)]);
  }
  return json({ ok: true }, 200, dailyCookie(req, day, token));
}

export async function board(req: Request) {
  const day = beijingDay();
  const received = readCookie(req, cookieName);
  const token = browserToken(received, day);
  const hash = await browserDigest(token);
  const [counts, own] = await queryVotes(
    ["SELECT candidate, COUNT(*) AS total, SUM(CASE WHEN day = ? THEN 1 ELSE 0 END) AS today FROM votes GROUP BY candidate", day],
    ["SELECT candidate FROM votes WHERE day = ? AND voter = (SELECT -id FROM browser_voters WHERE token_hash = ?) ORDER BY rowid", day, hash],
  );
  // Shorten an existing year-long cookie on the browser's next visit, preserving today's ballot.
  const cookie = hash && received === token && day === beijingDay() ? dailyCookie(req, day, token) : undefined;
  return json({
    day, counts, members: memberCount, myVotes: own.map(row => row.candidate), myVote: own[0]?.candidate ?? null,
  }, 200, cookie);
}

export async function saveBallot(req: Request) {
  if (!mutationAllowed(req)) return json({ error: "请从榜单页面重新投票。" }, 403);
  const candidate = (await readObject(req))?.candidate;
  if (!validMember(candidate)) return json({ error: "请先选择一位群友。" }, 400);

  const day = beijingDay();
  const voter = await browserVoter(browserToken(readCookie(req, cookieName), day));
  if (voter === null) return json({ error: "请允许此网站保存 Cookie，再确认投票。" }, 428);

  const [inserted, own] = await queryVotes(
    // The count and the insert share a single SQLite write statement. Concurrent
    // tabs cannot both reserve the final slot. The primary key rejects repeats.
    [`INSERT INTO votes (day, voter, candidate)
      SELECT ?, ?, ? WHERE (SELECT COUNT(*) FROM votes WHERE voter = ? AND day = ?) < ?
      ON CONFLICT(voter, day, candidate) DO NOTHING RETURNING candidate`,
      day, voter, candidate, voter, day, dailyVoteLimit],
    ["SELECT candidate FROM votes WHERE day = ? AND voter = ? ORDER BY rowid", day, voter],
  );
  const myVotes = own.map(row => row.candidate);
  const state = { day, myVotes, myVote: myVotes[0] ?? null };
  if (!inserted.length) {
    const error = myVotes.includes(candidate) ? "今天已经投给过这位群友了。" : "今天的 3 票已经用完了。";
    return json({ ...state, error }, 409);
  }
  return json({ ...state, ok: true, candidate }, 201);
}
