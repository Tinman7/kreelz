// NAVER Clip (네이버 클립): Korean short clips about K-pop, K-drama, K-film, K-beauty and K-travel & food, found with
// NAVER's mobile clip search (no API key), written to nclip.js, which the page (both editions) loads and mixes into the
// shorts. Runs every few hours (.github/workflows/naverclip.yml) and touches nothing the nightly refresh writes.
// usage: node scripts/naverclip.mjs [nclip.js] [--check]        (config: scripts/naverclip.json)
import fs from "node:fs";
import { eatBlocked } from "./noeat.mjs";   // no big-eating mukbang (per David)
const CHECK = process.argv.includes("--check");
const OUT = process.argv.slice(2).find(a => !a.startsWith("--")) || "nclip.js";
const cfg = JSON.parse(fs.readFileSync("scripts/naverclip.json", "utf8"));
const UA = "Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36";
const DAY = 864e5, now = Date.now();
const unesc = s => s.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
// "조회 1.6천" / "조회 3.2만" / "조회 305" -> number
const views = s => { const m = /([\d.,]+)\s*(천|만|억)?/.exec(s || ""); if (!m) return 0; const n = parseFloat(m[1].replace(/,/g, "")); return Math.round(n * ({ 천: 1e3, 만: 1e4, 억: 1e8 }[m[2]] || 1)); };
// "2시간 전" / "1일 전" / "3주 전" / "2026.10.01." -> age in days
const age = s => { s = s || ""; let m;
  if ((m = /(\d+)\s*(분|시간)\s*전/.exec(s))) return 0;
  if ((m = /(\d+)\s*일\s*전/.exec(s))) return +m[1];
  if ((m = /(\d+)\s*주\s*전/.exec(s))) return 7 * m[1];
  if ((m = /(\d+)\s*개월\s*전/.exec(s))) return 30 * m[1];
  if ((m = /(\d{4})\.(\d{1,2})\.(\d{1,2})/.exec(s))) return Math.max(0, Math.floor((now - Date.parse(`${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}T00:00:00+09:00`)) / DAY));
  return 99; };
function clips(html) {   // every "clipItem" block of the search page is a JSON object
  const tag = '"templateId":"clipItem"}', out = []; let pos = 0;
  for (;;) { const j = html.indexOf(tag, pos); if (j < 0) break; pos = j + 1;
    const k = html.lastIndexOf('{"props":', j); if (k < 0) continue;
    try { out.push(JSON.parse(html.slice(k, j + tag.length)).props); } catch (e) {} }
  return out;
}
const NOT = new RegExp(cfg.not, "i"), NOT_SRC = new RegExp(cfg.not_source, "i");
const found = new Map(); let fetched = 0, failed = 0;
for (const g of cfg.groups) for (const q of (CHECK ? g.queries.slice(0, 2) : g.queries)) {
  const url = "https://m.search.naver.com/search.naver?ssc=tab.m_clip.all&query=" + encodeURIComponent(q);
  let html = "";
  try { const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" } }); if (r.ok) html = await r.text(); else failed++; } catch (e) { failed++; }
  fetched++;
  for (const p of clips(html)) {
    const id = (/seedMediaId=([0-9A-F]{20,64})/i.exec(p.descriptionHref || p.imageHref || "") || [])[1]; if (!id) continue;
    const title = unesc(p.description || ""), ch = unesc(p.source || ""), v = views(p.viewCount), d = age(p.createdAt);
    if (!title || NOT.test(title) || NOT_SRC.test(p.sourceHref || "") || NOT_SRC.test(ch)) continue;
    if (d > (g.max_days || cfg.max_days)) continue;
    if (v < (p.isCertified ? g.min_views_certified ?? cfg.min_views_certified : g.min_views ?? cfg.min_views)) continue;
    if (g.require && !new RegExp(g.require, "i").test(title + " " + ch)) continue;
    const old = found.get(id); if (old && old.v >= v) continue;
    found.set(id, { id, c: g.cat, t: title.slice(0, 160), ch, v, d, img: p.imageSrc || "", ok: !!p.isCertified, g: g.name });
  }
  await new Promise(s => setTimeout(s, 700 + Math.random() * 600));   // gently
}
// keep last runs' clips (fresh view counts win) for up to max_keep days
let prev = []; try { prev = JSON.parse(fs.readFileSync(OUT, "utf8").replace(/^window\.NCLIP=/, "").replace(/;\s*$/, "")).items || []; } catch (e) {}
const keep = new Map(prev.filter(x => !eatBlocked(x[2], x[3], x[1])).map(x => [x[0], x]));
const today = new Date(now + 9 * 3600e3).toISOString().slice(0, 10), up = d => new Date(now + 9 * 3600e3 - d * DAY).toISOString().slice(0, 10);
for (const x of found.values()) if (!eatBlocked(x.t, x.ch, x.c)) keep.set(x.id, [x.id, x.c, x.t, x.ch, x.v, up(x.d), x.img, x.ok ? 1 : 0]);
// per category: the most watched first, at most cap_per_cat; older than max_keep days drop out
const byCat = {};
for (const x of keep.values()) if ((now - Date.parse(x[5] + "T00:00:00+09:00")) / DAY <= cfg.max_keep) (byCat[x[1]] = byCat[x[1]] || []).push(x);
const items = Object.values(byCat).flatMap(l => l.sort((a, b) => b[4] - a[4]).slice(0, cfg.cap_per_cat));
const summary = { fetched, failed, found: found.size, kept: items.length, by_cat: Object.fromEntries(Object.entries(byCat).map(([k, l]) => [k, Math.min(l.length, cfg.cap_per_cat)])) };
if (!CHECK && (found.size || !prev.length)) fs.writeFileSync(OUT, "window.NCLIP=" + JSON.stringify({ built: new Date().toISOString(), items }) + ";\n");
const sample = [...found.values()].sort((a, b) => b.v - a.v);
for (const c of Object.keys(byCat)) console.log(`[${c}]`, sample.filter(x => x.c === c).slice(0, CHECK ? 8 : 5).map(x => `${x.v} ${x.ch}: ${x.t.slice(0, 50)}`).join("\n     "));
console.log(JSON.stringify(summary));
