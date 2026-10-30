// "Today in 3 minutes" (per David 2026-10-30): every night the 10 clips Korea watched most in the last two days — mixed
// across K-pop, dramas airing now, variety, film, food and beauty — each with one or two lines on what it is, written by
// Claude from the clip's own title, channel and YouTube description (nothing added), in Japanese and English.
// Output: data/digest.json (today) + data/digest/<date>.json (archive); scripts/seo.mjs turns them into the pages
// kreelz.com/k/today/ and /jp/k/today/ (+ one page per day). usage: YT_API_KEY=… ANTHROPIC_API_KEY=… node scripts/digest.mjs index.html
import fs from "node:fs";
import zlib from "node:zlib";

const YT = process.env.YT_API_KEY, AK = process.env.ANTHROPIC_API_KEY, MODEL = process.env.DIGEST_MODEL || "claude-haiku-5-5";
const site = process.argv[2] || "index.html";
const h = fs.readFileSync(site, "utf8");
const str = n => (new RegExp(`const ${n} = "([^"]*)"`).exec(h) || [])[1] || "";
const BUILT = str("FEED_BUILT");
if (!AK) { console.log("digest: no ANTHROPIC_API_KEY, skipped"); process.exit(0); }
const B = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_", dec2 = s => B.indexOf(s[0]) * 64 + B.indexOf(s[1]);
const shard = id => ((B.indexOf(id[0]) * 64 + B.indexOf(id[1])) % 256).toString(16).padStart(2, "0");
const S = {}; const tf = (d, id) => { const k = d + shard(id); if (!(k in S)) { try { S[k] = JSON.parse(fs.readFileSync(`t/${d}/${shard(id)}.json`, "utf8")) } catch { S[k] = {} } } return S[k][id] };
let vm = {}; try { vm = JSON.parse(zlib.gunzipSync(fs.readFileSync("data/vmeta.json.gz"))); } catch {}
const ids11 = s => { const o = new Set(); for (let i = 0; i + 11 <= s.length; i += 11) o.add(s.slice(i, i + 11)); return o };
const JPO = ids11(str("PRIO_JPO")), NOW = ids11(str("PRIO_NOW")), VAR = ids11(str("PRIO_JPVAR"));
const FC = { m: "music", d: "drama", f: "film", e: "variety", k: "food", b: "beauty" };
const cand = [];
for (const [name, short] of [["FEED", false], ["SHORTS", true]]) {
  const s = str(name);
  for (let i = 0; i + 16 <= s.length; i += 16) {
    const id = s.slice(i, i + 11), c = s[i + 11], vc = dec2(s.slice(i + 12, i + 14)), days = dec2(s.slice(i + 14, i + 16));
    if (days > 2 || vc === 4095 || JPO.has(id) || c !== c.toUpperCase()) continue;   // last 2 days, official channels, on both editions
    const o = tf("o", id) || [], v = vm[id] || [], t = o[0] || v[0]; if (!t) continue;
    const cat = VAR.has(id) ? "variety" : c === "E" ? "" : FC[c.toLowerCase()]; if (!cat) continue;   // variety shows filed elsewhere count as variety
    const views = Math.round(Math.pow(1.006, vc) - 1);
    cand.push({ id, short, cat, t, ch: o[1] || v[2] || "", views, sc: views / (days + 1) * (NOW.has(id) ? 1.5 : 1) });
  }
}
cand.sort((a, b) => b.sc - a.sc);
const QUOTA = { music: 3, drama: 2, variety: 2, film: 1, food: 1, beauty: 1 }, perCh = {}, pick = [];
for (const x of cand) {
  if (pick.length >= 10) break;
  if ((QUOTA[x.cat] || 0) <= 0 || (perCh[x.ch] || 0) >= 1) continue;
  QUOTA[x.cat]--; perCh[x.ch] = (perCh[x.ch] || 0) + 1; pick.push(x);
}
for (const x of cand) { if (pick.length >= 10) break; if (!pick.includes(x) && (perCh[x.ch] || 0) < 2) { perCh[x.ch] = (perCh[x.ch] || 0) + 1; pick.push(x) } }
if (pick.length < 5) { console.log("digest: too few clips", pick.length); process.exit(0); }
// the clips' own descriptions (1 API unit)
if (YT) try {
  const r = await fetch("https://www.googleapis.com/youtube/v3/videos?" + new URLSearchParams({ part: "snippet", id: pick.map(x => x.id).join(","), key: YT }));
  const d = await r.json(); for (const v of d.items || []) { const x = pick.find(p => p.id === v.id); if (x) x.desc = (v.snippet.description || "").replace(/https?:\/\/\S+/g, "").replace(/\n{2,}/g, "\n").slice(0, 700); }
} catch (e) { console.log("descriptions skipped:", e.message); }
const SYSTEM = `You write a daily digest of Korean entertainment clips for fans in Japan and worldwide.
For each clip you get its YouTube title, channel, category and description. For each, write:
- "ja_title": a short natural Japanese title (max 40 characters) naming the artist/actor/show as Japanese fans know them (katakana names, Japanese show names when they exist).
- "ja": 1–2 short Japanese sentences (max 70 characters in all) saying what the clip is and why fans would watch it.
- "en_title": a short natural English title (max 70 characters).
- "en": 1–2 short English sentences (max 140 characters in all), same content.
Rules: use ONLY facts in the given title, channel and description. Do not invent plot details, rankings, dates, numbers or reactions. If the description says little, describe the clip plainly (e.g. "the official preview of episode 5"). No hashtags, no emojis, no hype words like "legendary".
Output ONLY a JSON object {"<key>": {"ja_title":…, "ja":…, "en_title":…, "en":…}, …} with exactly the keys given.`;
const user = JSON.stringify(Object.fromEntries(pick.map((x, k) => [String(k), { title: x.t, channel: x.ch, category: x.cat, description: x.desc || "" }])));
let out = null;
for (let t = 0; t < 4 && !out; t++) {
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST",
      headers: { "x-api-key": AK, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 4000, system: SYSTEM, messages: [{ role: "user", content: user }], thinking: { type: "disabled" } }) });
    const d = await r.json();
    if (!r.ok) { console.log("Claude", r.status, JSON.stringify(d.error || d).slice(0, 200)); await new Promise(s => setTimeout(s, 4000 * (t + 1))); continue; }
    const txt = (d.content || []).map(c => c.text || "").join(""); out = JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1));
    console.log("tokens", d.usage?.input_tokens, d.usage?.output_tokens);
  } catch (e) { console.log("digest attempt failed:", e.message); }
}
if (!out) { console.log("digest: no answer, yesterday's stays"); process.exit(0); }
const clip = s => String(s || "").replace(/\s+/g, " ").trim();
const items = pick.map((x, k) => { const o = out[String(k)] || {};
  return { id: x.id, short: x.short, cat: x.cat, ch: x.ch, views: x.views, t: x.t,
    ja_title: clip(o.ja_title).slice(0, 60), ja: clip(o.ja).slice(0, 140), en_title: clip(o.en_title).slice(0, 90), en: clip(o.en).slice(0, 220) } })
  .filter(x => x.ja && x.en);
const D = { date: BUILT, items };
fs.mkdirSync("data/digest", { recursive: true });
fs.writeFileSync("data/digest.json", JSON.stringify(D, null, 1) + "\n");
fs.writeFileSync(`data/digest/${BUILT}.json`, JSON.stringify(D, null, 1) + "\n");
for (const f of fs.readdirSync("data/digest").sort().slice(0, -60)) fs.rmSync(`data/digest/${f}`);   // 60 days kept
console.log(`digest ${BUILT}: ${items.length} clips —`, items.map(x => `${x.cat}:${x.ja_title}`).join(" | "));
