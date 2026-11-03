// Local K-content YouTube channels in Japan, the Philippines and Indonesia to work with (per David 2026-11-03: "일본·필리핀·
// 인도네시아 유튜브 채널을 통해서 홍보"). Channels run by people there who talk about K-pop / K-dramas in their own language:
// their viewers are exactly the fans KREELZ is for. Once a week: channel searches by country (search.list type=channel,
// regionCode + relevanceLanguage, 100 units each), then channels.list (subscribers, country, description; 1 unit per 50) and
// the date of each channel's latest upload (playlistItems.list, 1 unit). Kept: 3,000–2,000,000 subscribers, 30+ videos,
// an upload in the last 45 days, not a Korean channel. Public business e-mails written in the channel description are
// shown; otherwise the channel's About page (YouTube shows the e-mail there after a captcha).
// Output: data/ytcollab.json — read by scripts/seo.mjs (daily picks + creator kit) and the admin page.
// usage: YT_API_KEY=... node scripts/ytcollab.mjs
import fs from "node:fs";

const KEY = process.env.YT_API_KEY; if (!KEY) { console.log("ytcollab: no YT_API_KEY"); process.exit(0); }
const API = "https://www.googleapis.com/youtube/v3/", DAY = 864e5;
let units = 0;
async function call(ep, params, cost) {
  const r = await fetch(API + ep + "?" + new URLSearchParams({ ...params, key: KEY }));
  const d = await r.json().catch(() => ({}));
  if (d.error) { if (/quota/i.test(JSON.stringify(d.error))) throw new Error("quota"); return { items: [] }; }
  units += cost; return d;
}
const C = {
  JP: { lang: "ja", name: "일본", q: ["韓国 K-POP 情報", "韓国ドラマ 紹介", "K-POP 解説 アイドル", "韓国アイドル ニュース 日本語"],
        ok: t => /[ぁ-んァ-ヶ]/.test(t) },
  PH: { lang: "en", name: "필리핀", q: ["kpop reaction philippines", "kdrama review tagalog", "kpop news pinoy", "kdrama recap tagalog"],
        ok: t => /\b(pinoy|pinay|tagalog|filipin[oa]|philippines|ph|mga|ang|naman|talaga|lang|kayo|tayo)\b/i.test(t) },
  ID: { lang: "id", name: "인도네시아", q: ["kpop indonesia", "review drakor", "berita kpop terbaru", "reaksi kpop indonesia"],
        ok: t => /\b(indonesia|drakor|yang|dan|untuk|terbaru|banget|kalian|nonton|bahasa)\b/i.test(t) },
};
const old = (() => { try { return JSON.parse(fs.readFileSync("data/ytcollab.json", "utf8")); } catch { return { countries: {} }; } })();
const out = { updated: new Date().toISOString(), countries: {}, when: { ...(old.when || {}) } };
// the channel must be about Korean entertainment (title or description), not a general creator who once said "K-POP"
const KTOPIC = { JP: /韓国|韓流|k-?pop|ケーポップ|韓ドラ|韓国ドラマ|ハングル|kドラマ/i, PH: /k-?pop|k-?drama|korean|korea|hallyu/i, ID: /k-?pop|drakor|korea|k-?drama|hallyu/i };
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
try {
  for (const [cc, cfg] of Object.entries(C)) {
    // a country searched in the last 6 days is kept as it is (a run stopped by the quota goes on with the others next time)
    old.countries[cc] = (old.countries[cc] || []).filter(c => KTOPIC[cc].test(c.title + " " + c.desc));
    if ((old.countries[cc] || []).length && old.when && old.when[cc] && Date.now() - Date.parse(old.when[cc]) < 6 * DAY) { out.countries[cc] = old.countries[cc]; continue; }
    const ids = new Set();
    for (const q of cfg.q) {
      const d = await call("search", { part: "id", q, type: "channel", regionCode: cc, relevanceLanguage: cfg.lang, maxResults: 50 }, 100);
      for (const x of d.items || []) if (x.id?.channelId) ids.add(x.id.channelId);
    }
    const chans = [];
    const L = [...ids];
    for (let i = 0; i < L.length; i += 50) {
      const d = await call("channels", { part: "snippet,statistics,contentDetails", id: L.slice(i, i + 50).join(","), maxResults: 50 }, 1);
      for (const c of d.items || []) {
        const s = c.snippet || {}, st = c.statistics || {}, subs = +st.subscriberCount || 0, vids = +st.videoCount || 0;
        const text = (s.title || "") + " " + (s.description || "");
        if (subs < 3000 || subs > 2000000 || vids < 30 || st.hiddenSubscriberCount) continue;
        if (s.country === "KR" || /[가-힣]/.test(s.title || "")) continue;   // Korean channels are not the point here
        if (s.country && s.country !== cc && !(cc === "PH" && !s.country)) continue;
        if (!s.country && !cfg.ok(text)) continue;
        if (!KTOPIC[cc].test(text)) continue;
        chans.push({ id: c.id, title: s.title, handle: s.customUrl || "", subs, videos: vids, country: s.country || "",
          email: (s.description || "").match(EMAIL)?.[0] || "", desc: (s.description || "").replace(/\s+/g, " ").slice(0, 160),
          uploads: c.contentDetails?.relatedPlaylists?.uploads || "" });
      }
    }
    chans.sort((a, b) => b.subs - a.subs);
    const keep = [];
    for (const c of chans.slice(0, 60)) {   // still active: an upload in the last 45 days
      if (!c.uploads) continue;
      const d = await call("playlistItems", { part: "contentDetails", playlistId: c.uploads, maxResults: 1 }, 1);
      const last = d.items?.[0]?.contentDetails?.videoPublishedAt || "";
      if (!last || Date.now() - Date.parse(last) > 45 * DAY) continue;
      delete c.uploads; c.last = last.slice(0, 10);
      const prev = (old.countries[cc] || []).find(o => o.id === c.id); if (prev && prev.since) c.since = prev.since; else c.since = new Date().toISOString().slice(0, 10);
      keep.push(c); if (keep.length >= 25) break;
    }
    out.countries[cc] = keep; out.when[cc] = new Date().toISOString();
    console.log(cc, "searched", ids.size, "kept", keep.length);
  }
} catch (e) { console.log("ytcollab stopped:", e.message); }
for (const cc of Object.keys(C)) if (!out.countries[cc] || !out.countries[cc].length) out.countries[cc] = old.countries[cc] || [];
fs.writeFileSync("data/ytcollab.json", JSON.stringify(out, null, 1) + "\n");
console.log(JSON.stringify({ units, ...Object.fromEntries(Object.entries(out.countries).map(([k, v]) => [k, v.length])) }));
