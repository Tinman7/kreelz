// No big-eating mukbang on either edition (per David, 2026-10-29): eating-show channels (대식·ASMR 먹방) and
// eating-show titles are kept off the site. Travel / restaurant / cooking food videos stay.
// usage: node scripts/noeat.mjs index.html [--dry]   (drops matching ids from FEED and SHORTS using the t/o title shards,
//        and from live.js and nclip.js). Other scripts import { eatBlocked } to keep them out at collection time.
import fs from "fs";
import zlib from "zlib";

// eating-show channels, by channel name as YouTube / NAVER shows it
export const EAT_CH = new Set([
  "바니 Bunny EATING", "쏘영 Ssoyoung", "Jimmy ASMR", "가르마[GARMA]", "흥삼이네 Heungsam's Family", "애정 Aejeong",
  "면상호[NoodleFighter]", "[햄지]Hamzy", "[AmiAmi]아미아미", "온화 ONHWA", "HONG SOUND", "CME 먹방 ASMR", "히밥heebab",
  "choa asmr", "[Mukgang] 먹갱", "ZOEY ASMR 조이", "용용먹방 YongYong", "JaeYeol ASMR 재열", "tzuyang쯔양", "문복희 Eat with Boki",
  "만리 manli", "마빡", "상해기SangHyuk", "먹보스 쭈엽이", "밥슨[Spicyking]", "루시 Lucy ASMR", "Wooang 우앙", "지피티",
  "설기양SULGI", "GONGSAM TABLE 이공삼", "SHORTS TABLE 이공삼", "SIO ASMR", "DDM ASMR 땅규", "Jane ASMR 제인",
  "혼술다큐 미짱 lonely mizzang", "까니짱 [ KANI, 蟹ちゃん]", "돼끼 baby_pig_rabbit", "웅이woongei", "떵개떵", "슈기님",
  "Jings ASMR 징스", "DONA 도나", "잘먹는입큰언니", "SmartMonkey", "GAOTV", "Hongyu ASMR 홍유", "HIU 하이유", "박홍 Bakkong",
  "푸먹_foomuk", "자곰 JAGOM ASMR", "KaoruTV", "玉珍", "Mala먹방", "츄베릅JMT", "굿찌 GOODZZI", "러블리y", "BENI 유베니",
  "오눌오눌", "Sparkly Disney Princess ASMR", "푸메Fume", "[후찌네] Hujiine", "뿌니", "[상윤쓰]Sangyoon", "Eating Food Show",
  "당비 Dangbee EATING", "Captain-Q ASMR 캡틴큐", "Eddy ASMR 에디", "차니세끼", "꿀발견", "푸디라임", "유노-Yuno", "현오 HyunO",
  "또호 DDO_HO", "또솔 DDO_SOL", "팀브라더스", "sini시니", "푸디앨리", "잡솨", "한식푸우 Korean food", "준맛 jun taste", "밥주니",
  "봉길이 Bonggil", "VNM ASMR", "효닝 Hyoning", "김복순", "대평이 Daepyeong",
  "Ssoyoung", "Hamzy", "Tzuyang", "Boki", "Heebab", "zach choi ASMR", "SAS-ASMR", "Bethany Gaskin", "Nikocado Avocado",
]);
const norm = s => String(s || "").toLowerCase().replace(/\s+/g, "");
const EAT_CHN = new Set([...EAT_CH].map(norm));
// eating-show words in a title (food-tab videos only; idols' and actors' clips that say "mukbang" are not touched)
export const EAT_T = /먹방\s*asmr|asmr\s*먹방|mukbang|eating\s*(show|sounds?)|리얼\s*사운드\s*먹방|대식|푸드\s*파이터|푸파\s*(대결|도전)?|food\s*fight|大食い|咀嚼音|吃播|\d+\s*(kg|킬로)\s*(먹|도전|챌린지|클리어)|\d+\s*인분\s*(먹|도전|클리어|혼자)|먹방\s*(챌린지|도전)|eating\s*challenge|폭식/i;
// 爆食 (eat a lot) is how Japanese travel vlogs say "ate everything on the trip": blocked only when it is not a trip
const BAKU = /爆食/, TRIP = /旅|旅行|vlog|ツアー|コース|食べ歩き|ソウル|釜山|明洞|市場/i;
// food channels that use those words for travel or restaurant visits, not eating shows
const KEEP_CH = new Set(["어서와 한국은 처음이지", "성시경 SUNG SI KYUNG", "CHOIZA ROAD - 최자로드", "FOXandBEAR 여우곰채널",
  "韓国観光公社 日本公式チャンネル", "EBSDocumentary (EBS 다큐)", "살찐삼촌 이장우", "김숙티비kimsookTV", "더들리", "옥스푼"].map(norm));
const EAT_CH_RE = /(mukbang|먹방|eating)\s*(asmr)?$|^(asmr|먹방)/i;   // channel names that are eating shows by name

export function eatBlocked(title, channel, cat) {
  const c = norm(channel);
  if (EAT_CHN.has(c)) return true;
  if (KEEP_CH.has(c)) return false;
  if (cat && !/^(k|mukbang)$/i.test(cat)) return false;
  const t = String(title || "");
  return EAT_T.test(t) || (BAKU.test(t) && !TRIP.test(t)) || EAT_CH_RE.test(String(channel || "").trim());
}

if (process.argv[1] && process.argv[1].endsWith("noeat.mjs")) {
  const site = process.argv[2] || "index.html", dry = process.argv.includes("--dry");
  let h = fs.readFileSync(site, "utf8");
  const shard = {};
  const B = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const sh = id => ((B.indexOf(id[0]) * 64 + B.indexOf(id[1])) % 256).toString(16).padStart(2, "0");
  const T = id => { const k = sh(id); if (!(k in shard)) { try { shard[k] = JSON.parse(fs.readFileSync(`t/o/${k}.json`, "utf8")) } catch { shard[k] = {} } } return shard[k][id] };
  const bad = new Set(), why = {};
  for (const name of ["FEED", "SHORTS"]) {
    const m = h.match(new RegExp(`const ${name} = "([^"]*)";`)); const s = m[1]; let keep = "", n = 0;
    for (let i = 0; i + 16 <= s.length; i += 16) {
      const id = s.slice(i, i + 11), cat = s[i + 11].toLowerCase(), e = T(id);
      if (e && eatBlocked(e[0], e[1], cat)) { bad.add(id); n++; why[e[1] || "?"] = (why[e[1] || "?"] || 0) + 1; continue }
      keep += s.slice(i, i + 16);
    }
    console.log(name, n, "eating-show videos removed");
    h = h.replace(m[0], () => `const ${name} = "${keep}";`);
  }
  console.log(Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => `${v} ${k}`).join("\n"));
  if (!dry) {
    fs.writeFileSync(site, h);
    // live.js: [id,cat,views,upDay,rankG,rankJ,title,channel,...]
    try {
      let l = fs.readFileSync("live.js", "utf8"); const m = l.match(/^window\.LIVE=(.*);?\s*$/s);
      if (m) { const L = JSON.parse(m[1].replace(/;\s*$/, "")); let n = 0;
        for (const k of ["v", "s"]) if (Array.isArray(L[k])) L[k] = L[k].filter(x => { const b = bad.has(x[0]) || eatBlocked(x[6], x[7], x[1]); n += b; return !b });
        if (n) { fs.writeFileSync("live.js", "window.LIVE=" + JSON.stringify(L) + ";\n"); console.log("live.js", n, "removed") } }
    } catch (e) { console.log("live.js skipped:", e.message) }
    // nclip.js: [mediaId, cat, title, channel, views, day, thumb, certified]
    try {
      const raw = fs.readFileSync("nclip.js", "utf8"); const N = JSON.parse(raw.replace(/^window\.NCLIP=/, "").replace(/;\s*$/, ""));
      const before = N.items.length; N.items = N.items.filter(x => !eatBlocked(x[2], x[3], x[1]));
      if (N.items.length < before) { fs.writeFileSync("nclip.js", "window.NCLIP=" + JSON.stringify(N) + ";\n"); console.log("nclip.js", before - N.items.length, "removed") }
    } catch (e) { console.log("nclip.js skipped:", e.message) }
  }
}
