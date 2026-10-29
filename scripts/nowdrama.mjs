// Screen tab, both editions: dramas airing now come first (per David 2026-10-30). Nightly, from the official clips of the
// last 3 weeks (broadcasters, cable and OTT channels; archive/clip channels left out), clips are grouped by drama — the
// hashtag, [title], 〈title〉, 『title』 or "| title |" part of the video title — and a drama counts as airing with 3+ clips.
// Dramas are ranked by views per day; the clips are written round-robin (best of each drama, then the next…) as PRIO_NOW.
// usage: node scripts/nowdrama.mjs index.html [--dry]
import fs from "fs";
import zlib from "zlib";
import { VAR } from "./jpvariety.mjs";

const site = process.argv[2] || "index.html", dry = process.argv.includes("--dry");
let h = fs.readFileSync(site, "utf8");
const vm = JSON.parse(zlib.gunzipSync(fs.readFileSync("data/vmeta.json.gz")));
const B = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_", dec2 = s => B.indexOf(s[0]) * 64 + B.indexOf(s[1]);
const DAYS = 21;
// channels that re-post old dramas (archives, clip and recap channels)
const ARCHIVE = /mnet|k-?pop|클래식|classic|올끌|tv-?people|디글|wavve|웨이브|스튜디오지니|잇츠뉴|빵터짐|요약|고몽|리뷰|드라마 ?맛집|숏드|kbs drama classic|mbc ?classic|sbs ?catch/i;
// words that are not a drama's name
const GENERIC = /^(선공개|후공개|예고|예고편|티저|메인 ?티저|티저 ?예고편|공식 ?예고편|메인 ?예고편|하이라이트|\d+ ?(화|회)( ?(예고|하이라이트|선공개|클립|메이킹))?|ep\.? ?\d+.*|메이킹|비하인드|스페셜|special|shorts?|쇼츠|클립|clip|tving|티빙|넷플릭스|netflix|디즈니\+?|disney\+?.*|웨이브|wavve|쿠팡플레이|coupang ?play|eng ?sub|sub|eng|kor|jpn|official|trailer|teaser|preview|now playing|kbs.*|mbc.*|sbs.*|jtbc.*|tvn.*|ena.*|\d{6} ?방송|방송|drama|드라마|k-?drama|韓国ドラマ|韓ドラ|kdrama|번개클립|실시간|습픽.*|.*\b(mlb|kbo|kespa|lol|nba|epl)\b.*|\d+-\d*.*|.*10주년.*|통합 ?티저|\d+차 ?티저|넷플릭스 ?\d+주년|넷플잔치|오늘의 ?.*|.{0,1})$/i;
const keyOf = t => {
  const c = [];
  for (const m of t.matchAll(/#([^\s#|ㅣ｜\[\]〈〉《》『』「」()]{2,25})/g)) c.push(m[1]);
  for (const m of t.matchAll(/[\[〈《『「]([^\]〉》』」]{2,30})[\]〉》』」]/g)) c.push(m[1].replace(/^#/, "").replace(/\s*(\d+ ?(화|회).*|스페셜.*|선공개.*|예고.*|하이라이트.*|메이킹.*)$/, ""));
  for (const seg of t.split(/[|ㅣ｜]/).slice(1)) c.push(seg.trim());
  const k = c.map(x => x.trim()).find(x => x && !GENERIC.test(x) && !/^(shorts|newrecruit|100daysofdeception)/i.test(x));
  return k ? k.split(/[:：]/)[0].replace(/\s+/g, "").toLowerCase().replace(/^(채널a|kbs2?|mbc|sbs|tvn|jtbc|ena|mbn)?(토일|월화|수목|금토|일일|주말|미니시리즈)?드라마/, "").replace(/(\d+(화|회)|제작발표회|스페셜|메이킹|비하인드|[✔✨🔥]+)+$/u, "") : "";
};
const clips = [];
for (const name of ["FEED", "SHORTS"]) {
  const s = h.match(new RegExp(`const ${name} = "([^"]*)";`))[1];
  for (let i = 0; i + 16 <= s.length; i += 16) {
    if (s[i + 11] !== "D") continue;   // drama (Screen) from an official channel
    const id = s.slice(i, i + 11), days = dec2(s.slice(i + 14, i + 16)), v = vm[id];
    if (!v || days > DAYS || ARCHIVE.test(v[2] || "") || VAR.test(v[0] || "")) continue;   // variety clips filed under Screen stay out
    const k = keyOf(v[0] || ""); if (!k) continue;
    const vc = dec2(s.slice(i + 12, i + 14)), views = vc === 4095 ? 0 : Math.round(Math.pow(1.006, vc) - 1);
    clips.push({ id, k, sc: views / (days + 1), t: v[0], ch: v[2] });
  }
}
const by = {}; for (const c of clips) (by[c.k] = by[c.k] || []).push(c);
const dramas = Object.entries(by).filter(([, l]) => l.length >= 3).map(([k, l]) => ({ k, l: l.sort((a, b) => b.sc - a.sc), sc: l.reduce((n, c) => n + c.sc, 0) })).sort((a, b) => b.sc - a.sc).slice(0, 40);
const order = []; for (let r = 0; r < 30; r++) for (const d of dramas) if (d.l[r]) order.push(d.l[r].id);
console.log("airing dramas:", dramas.length, "clips:", order.length);
console.log(dramas.slice(0, 25).map(d => `${d.l.length} ${d.k}  ← ${d.l[0].ch}: ${d.l[0].t.slice(0, 60)}`).join("\n"));
if (!dry) {
  const line = `const PRIO_NOW = "${order.join("")}";`;
  if (/const PRIO_NOW = "[^"]*";/.test(h)) h = h.replace(/const PRIO_NOW = "[^"]*";/, () => line);
  else { const m = h.match(/const FEED_BUILT = "[^"]*";/); h = h.replace(m[0], () => m[0] + "\n" + line); }
  fs.writeFileSync(site, h);
}
