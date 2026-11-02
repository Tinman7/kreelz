// Dramas and films for fans abroad (per David 2026-11-02: "영화나 드라마는 해외 팬들한테서 반응이 있거나 해외 팬들이 게시한 걸,
// 국내에서만 알려진 것들은 선별해서 빼야"). Both editions, Screen and Film clips (cat d/f).
// Tried first: reading each clip's comments and keeping the ones with comments in other languages. It does not work —
// fans abroad comment on the English uploads (Netflix, Disney+, fan edits), not on the Korean broadcaster's clip, so even
// global hits (재혼 황후 on Disney+) showed 0% (test 2026-11-02, 15 clips). So the rule is by the kind of drama instead:
//  - long-running daily / weekend family dramas (episode 21 and up — mini-series abroad know run 12–16) are domestic:
//    every clip of such a drama on a broadcaster / drama channel comes off (the drama's name is taken from its clips)
//  - clips posted for fans abroad (title with no Korean) are lifted in the ranking by scripts/viral.mjs
// No API units. usage: node scripts/overseas.mjs index.html [--dry]
import fs from "node:fs";
import zlib from "node:zlib";

const site = process.argv[2] || "index.html", dry = process.argv.includes("--dry");
const B = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const sh = id => ((B.indexOf(id[0]) * 64 + B.indexOf(id[1])) % 256).toString(16).padStart(2, "0");
let vm = {}; try { vm = JSON.parse(zlib.gunzipSync(fs.readFileSync("data/vmeta.json.gz"))); } catch {}
const S = {}; const tO = id => { const k = sh(id); if (!(k in S)) { try { S[k] = JSON.parse(fs.readFileSync(`t/o/${k}.json`, "utf8")) } catch { S[k] = {} } } return S[k][id] };
const title = id => (vm[id] && vm[id][0]) || (tO(id) || [])[0] || "", chan = id => (vm[id] && vm[id][2]) || (tO(id) || [])[1] || "";
const EP = /(?:^|[^\d])(\d{2,3})\s*(?:화|회)(?!\s*(?:차|째|만에|년|분))|\bep\.?\s*(\d{2,3})\b|episode\s*(\d{2,3})/i;
const DRAMA_CH = /drama|드라마|드:|kbs|mbc|sbs|채널\s?a|채널에이|jtbc|tv ?조선|tvchosun|mbn|tvn|ena|wavve|웨이브|옛드|tving|티빙/i;
const BR = /[\[［【『「]([^\]］】』」]{2,40})[\]］】』」]/g, NOISE = /\s*\d+\s*(화|회).*$|\s*ep\.?\s*\d+.*$|\s*\d+\s*-.*$|\s*모음.*$|예고|선공개|하이라이트|스페셜|티저|메이킹|비하인드|모아보기|명장면|[|ㅣ].*$|^#/gi;
const NOT_A_NAME = /^(사극픽|옛드|드라마|코멘터리|레전드사극|멤버십전용|캔모아|마라맛|애로드라마|쇼츠|shorts)$/i;
let h = fs.readFileSync(site, "utf8");
const rows = [];
for (const name of ["FEED", "SHORTS"]) {
  const s = (h.match(new RegExp(`const ${name} = "([^"]*)";`)) || [, ""])[1];
  for (let i = 0; i + 16 <= s.length; i += 16) { const c = s[i + 11].toLowerCase(); if (c === "d" || c === "f") rows.push(s.slice(i, i + 11)); }
}
const longRun = id => { const m = EP.exec(title(id)); const e = m ? +(m[1] || m[2] || m[3]) : 0; return e >= 21 && e <= 400 && DRAMA_CH.test(chan(id)); };
// the names of those dramas, from the brackets of their clips ([사랑이 온다], [가족관계증명서 72회 예고] -> 가족관계증명서)
const keys = new Set();
for (const id of rows) if (longRun(id)) for (const m of title(id).matchAll(BR)) { const k = m[1].replace(NOISE, "").trim(); if (k.length >= 3 && /[가-힣]/.test(k) && !NOT_A_NAME.test(k)) keys.add(k); }
const drop = new Set(rows.filter(id => longRun(id) || (DRAMA_CH.test(chan(id)) && [...keys].some(k => title(id).includes(k)))));
if (!dry) {
  for (const name of ["FEED", "SHORTS"]) {
    const m = h.match(new RegExp(`const ${name} = "([^"]*)";`)); if (!m) continue; const s = m[1]; let o = "";
    for (let i = 0; i + 16 <= s.length; i += 16) if (!drop.has(s.slice(i, i + 11))) o += s.slice(i, i + 16);
    h = h.replace(m[0], () => `const ${name} = "${o}";`);
  }
  fs.writeFileSync(site, h);
}
console.log(JSON.stringify({ screen_film_clips: rows.length, domestic_long_running_dramas: [...keys].slice(0, 40), taken_off: drop.size }));
if (dry) console.log([...drop].slice(0, 15).map(id => `  ${chan(id)} | ${title(id).slice(0, 60)}`).join("\n"));
