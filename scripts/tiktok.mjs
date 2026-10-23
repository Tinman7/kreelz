// TikTok shorts added by hand on the admin page (Supabase table tiktok_links, see setup/tiktok.sql).
// Writes them into the site as   const TIKTOK = [[videoId, account, cat, title, "YYYY-MM-DD added", thumbnail], ...];
// usage: node scripts/tiktok.mjs index.html
// If Supabase can't be reached the site keeps yesterday's list.
import fs from "node:fs";
const site = process.argv[2] || "index.html";
const SB_URL = "https://fvtvpjsveughnhnfjcef.supabase.co", SB_KEY = "sb_publishable_wFuEzcauXuYWkCpgZSWJ3A_5XYvDwQ2";
const h = fs.readFileSync(site, "utf8");
const RE = /^const TIKTOK = .*;$/m;
if (!RE.test(h)) { console.log("tiktok: no `const TIKTOK = ...;` line in the site, nothing to do"); process.exit(0); }
let rows;
try {
  const r = await fetch(`${SB_URL}/rest/v1/tiktok_links?select=vid,author,cat,title,added&order=added.desc,created_at.desc&limit=5000`,
    { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
  rows = await r.json();
} catch (e) { console.log("tiktok: could not read the list, keeping the current one:", e.message); process.exit(0); }
const ok = rows.filter(x => /^\d{8,25}$/.test(x.vid) && /^[\w.]{1,40}$/.test(x.author) && "mdfebk".includes(x.cat) && x.cat.length === 1);
// Check every video with TikTok's public oEmbed from here (browsers are often blocked from it): fills in the title and
// tonight's thumbnail, and leaves out videos that were deleted or made private. If TikTok answers nothing at all
// (outage, rate limit), nobody is dropped.
const check = async x => {
  try {
    const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(`https://www.tiktok.com/@${x.author}/video/${x.vid}`)}`, { signal: AbortSignal.timeout(15000) });
    if (r.status === 400 || r.status === 404) return { dead: true };
    if (!r.ok) return {};
    const d = await r.json(); return { alive: true, title: d.title || "", thumb: /^https:\/\//.test(d.thumbnail_url || "") ? d.thumbnail_url : "" };
  } catch { return {}; }
};
const res = new Array(ok.length);
for (let i = 0; i < ok.length; i += 8) (await Promise.all(ok.slice(i, i + 8).map(check))).forEach((r, k) => res[i + k] = r);
const anyAlive = res.some(r => r.alive), dead = [];
const list = [];
ok.forEach((x, i) => {
  const r = res[i];
  if (r.dead && anyAlive) { dead.push(`@${x.author}/video/${x.vid}`); return; }
  const title = String(x.title || r.title || "").replace(/\s+/g, " ").trim().slice(0, 300);
  list.push([x.vid, x.author, x.cat, title, x.added, r.thumb || ""]);
});
// JSON is valid JS; escape "<" so a title can never close the script tag
const line = `const TIKTOK = ${JSON.stringify(list).replace(/</g, "\\u003c")};`;
fs.writeFileSync(site, h.replace(RE, () => line));
console.log(`tiktok: ${list.length} TikTok shorts on the site (${res.filter(r => r.alive).length} checked with TikTok)` + (dead.length ? `; left out, deleted or private: ${dead.join(", ")}` : ""));
