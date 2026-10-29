// Write the Music priority list into the page: const PRIO_LIST = "<11-char id><rank char>..." (music items only)
// usage: node scripts/prio.mjs index.html data/vmeta.json.gz
import fs from "node:fs"; import zlib from "node:zlib";
import { rank, ARTISTS, EXTRA_MALE, FANCAM_M, JP_ARTISTS, rankIn } from "./hybe.mjs";
import { actorScore, jpActorKind, jpActorRank } from "./actors.mjs";
const [site, metaPath] = process.argv.slice(2);
let h = fs.readFileSync(site, "utf8");
const M = JSON.parse(zlib.gunzipSync(fs.readFileSync(metaPath)));
const RC = "123456789abcdefghijklmnopqrstuvwxyz";
// Japan edition: videos only shown on /jp (scripts/japan.mjs), and the Japan channels of the priority artists
const JPO = new Set(fs.existsSync("data/jp_only.json") ? JSON.parse(fs.readFileSync("data/jp_only.json", "utf8")) : []);
try { for (const c of JSON.parse(fs.readFileSync("scripts/jp_channels.json", "utf8")).channels) {
  const a = c.id && c.artist && JP_ARTISTS.find(x => x[0] === c.artist); if (a && !a[1].includes(c.id)) a[1].push(c.id); } } catch (e) {}
const jpo = [];
// kreelz.com/jp K-Travel & Food tab: these channels come first ("어서와 한국은 처음이지 / Welcome, First Time in Korea?", per David 2026-10-27)
const TRAVEL_FIRST = new Set(["UC4i1qf8CUH93DLSbD9efqig"]), welcome = [];
// Korean-language travel & restaurant picks (scripts/japan.mjs kr_reco): lifted in the /jp K-Travel & Food tab
// hanok stays (scripts/japan.mjs hanok_stay / hanok_kr): their own share of the /jp K-Travel & Food tab (per David 2026-10-29)
const HANOK = new Set(fs.existsSync("data/jp_hanok.json") ? JSON.parse(fs.readFileSync("data/jp_hanok.json", "utf8")) : []), hanok = [];
const RECO = new Set(fs.existsSync("data/jp_reco.json") ? JSON.parse(fs.readFileSync("data/jp_reco.json", "utf8")) : []), reco = [];
// and every video of the Korean creators picked for that tab (jp_channels.json channels with reco), already on the site or new
// (only = just the titles matching it, e.g. the 먹을텐데 episodes of 성시경's channel; skip = not these)
const RECO_CH = new Map(), TOP_CH = new Map(), top = [];   // channel id -> title filter
try { for (const c of JSON.parse(fs.readFileSync("scripts/jp_channels.json", "utf8")).channels) if (c.reco && c.id) {
  const re = c.only || c.skip ? { test: t => (!c.only || new RegExp(c.only, "i").test(t)) && !(c.skip && new RegExp(c.skip, "i").test(t)) } : null; RECO_CH.set(c.id, re); if (c.top) TOP_CH.set(c.id, RC[TOP_CH.size]); } } catch (e) {}
const chHit = (C, m) => !!m && C.has(m[1]) && !(RECO_CH.get(m[1]) && !RECO_CH.get(m[1]).test(m[0]));
// pinned at the top of All and Music (both editions) until a date: "hot" groups of scripts/konbini.json with pin (e.g.
// the ILLIT x Song Kang clips, per David 2026-10-27) — every video on the site whose title/tags match all their regexes
const PIN_G = (() => { try { const t = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  return (JSON.parse(fs.readFileSync("scripts/konbini.json", "utf8")).groups || []).filter(g => g.pin && g.until >= t)
    .map(g => ({ until: g.until, re: (g.require || []).map(r => new RegExp(r, "i")) })); } catch (e) { return []; } })();
const pin = []; let pinUntil = "";
// Japan edition: these two dramas go to the very end of every list on /jp (index.html moves PRIO_LAST_JP ids last)
const LAST_JP = /백일의 ?거짓말|100일의 ?거짓말|100 ?Days of Deception|百日の嘘|100日の嘘|닥터 ?X|Doctor ?X|ドクター ?X/i, lastJ = [];
const OTT = /netflix|넷플릭스|tving|티빙|disney ?(plus|\+)|디즈니 ?(플러스|\+)|coupang ?play|쿠팡플레이|wavve|웨이브|prime ?video|watcha|왓챠/i;
const OTT_NOT = /vevo|웨이브할미|still watching|family/i;
const ott = [], act = [], fan = [];
const list = [], counts = {};
const listJ = [], actJ = [], fanJ = [];   // Japan edition (kreelz.com/jp)
for (const n of ["SHORTS", "FEED"]) {
  const s = h.match(new RegExp(`const ${n} = "([^"]*)";`))[1];
  for (let i = 0; i + 16 <= s.length; i += 16) {
    const cc = s[i + 11].toLowerCase();
    if (JPO.has(s.slice(i, i + 11))) jpo.push(s.slice(i, i + 11));
    { const mm = M[s.slice(i, i + 11)]; if (mm && TRAVEL_FIRST.has(mm[1])) welcome.push(s.slice(i, i + 11)); }
    // top picked creators (성시경의 먹을텐데, 최자로드): id + which creator, so /jp can alternate them at the head of the tab
    if (HANOK.has(s.slice(i, i + 11))) hanok.push(s.slice(i, i + 11));
    { const id = s.slice(i, i + 11), m = M[id]; if (chHit(TOP_CH, m)) top.push(id + TOP_CH.get(m[1]));
      else if ((RECO.has(id) && !(m && TOP_CH.has(m[1]))) || chHit(RECO_CH, m)) reco.push(id); }
    { const m = M[s.slice(i, i + 11)]; if (m && LAST_JP.test(m[0] + " " + (m[5] || []).join(" "))) lastJ.push(s.slice(i, i + 11)); }
    { const m = M[s.slice(i, i + 11)]; if (m) { const t = m[0] + " " + (m[5] || []).join(" ");
      for (const g of PIN_G) if (g.re.length && g.re.every(r => r.test(t))) { pin.push(s.slice(i, i + 11)); if (g.until > pinUntil) pinUntil = g.until; break; } } }
    if ("dfe".includes(cc)) { const m = M[s.slice(i, i + 11)]; if (m && ((OTT.test(m[2]) && !OTT_NOT.test(m[2])) || JPO.has(s.slice(i, i + 11)))) ott.push(s.slice(i, i + 11));
      const sc = actorScore(m) || (rank(m) ? 1 : 0);   // priority idols' interviews / TV appearances join the focus pool
      if (sc) act.push(s.slice(i, i + 11) + sc);
      // Japan edition: kind of video of the ranked actors (r romance, f fan meeting, e event/fancam, m fan-made, o other);
      // priority idols' TV / interview clips join the pool as "o"
      // + the actor's place in JP_ACTORS (RC char; "z" = a priority idol), so /jp can take the actors in ranking order
      const kJ = jpActorKind(m) || (rankIn(JP_ARTISTS, m) ? "o" : "");
      if (kJ) actJ.push(s.slice(i, i + 11) + kJ + (jpActorRank(m) ? RC[jpActorRank(m) - 1] : "z")); continue; }
    if (cc !== "m") continue;
    const id = s.slice(i, i + 11), m = M[id], text = m ? m[0] + " " + (m[5] || []).join(" ") : "";
    let r = rank(m); const cam = !!m && FANCAM_M.test(text);
    if (!r && cam && EXTRA_MALE.some(a => a[2].test(text))) r = ARTISTS.length + 1;   // other boy groups' fancams: right after the list
    const rJ = rankIn(JP_ARTISTS, m) || (JPO.has(id) ? JP_ARTISTS.length + 1 : 0);   // other Japan-channel music right after the list
    if (rJ) { listJ.push(id + RC[rJ - 1]); if (cam) fanJ.push(id); }
    if (r) { list.push(id + RC[r - 1]); const nm = ARTISTS[r - 1] ? ARTISTS[r - 1][0] : "other boy groups"; counts[nm] = (counts[nm] || 0) + 1; if (cam) fan.push(id); }
  }
}
const line = `const PRIO_LIST = "${list.join("")}"; const PRIO_OTT = "${ott.join("")}"; const PRIO_ACT = "${act.join("")}"; const PRIO_FAN = "${fan.join("")}"; const PRIO_LIST_JP = "${listJ.join("")}"; const PRIO_ACTK_JP = "${actJ.join("")}"; const PRIO_FAN_JP = "${fanJ.join("")}"; const PRIO_JPO = "${jpo.join("")}"; const PRIO_LAST_JP = "${lastJ.join("")}"; const PRIO_WELCOME = "${welcome.join("")}"; const PRIO_JPRECO = "${reco.join("")}"; const PRIO_JPTOP = "${top.join("")}"; const PRIO_PIN = "${pin.length ? pinUntil + "|" + pin.join("") : ""}"; const PRIO_JPHANOK = "${hanok.join("")}";`;
h = h.replace(/const PRIO_BTS = "[^"]*"; const PRIO_HYBE = "[^"]*";/, line);
h = h.replace(/ const PRIO_OTT = "[^"]*";/, "").replace(/ const PRIO_ACT = "[^"]*";/, "").replace(/ const PRIO_FAN = "[^"]*";/, "")
  .replace(/ const PRIO_LIST_JP = "[^"]*";/, "").replace(/ const PRIO_ACT_JP = "[^"]*";/, "").replace(/ const PRIO_ACTK_JP = "[^"]*";/, "").replace(/ const PRIO_FAN_JP = "[^"]*";/, "").replace(/ const PRIO_JPO = "[^"]*";/, "").replace(/ const PRIO_LAST_JP = "[^"]*";/, "")
  .replace(/ const PRIO_WELCOME = "[^"]*";/, "").replace(/ const PRIO_JPRECO = "[^"]*";/, "").replace(/ const PRIO_JPTOP = "[^"]*";/, "").replace(/ const PRIO_PIN = "[^"]*";/, "").replace(/ const PRIO_JPHANOK = "[^"]*";/, "");
if (/const PRIO_LIST = "[^"]*";/.test(h)) h = h.replace(/const PRIO_LIST = "[^"]*";/, line);
else { const m = h.match(/const FEED_BUILT = "[^"]*";/); h = h.replace(m[0], m[0] + "\n" + line); }
fs.writeFileSync(site, h);
console.log(JSON.stringify({ ...counts, OTT_screen_shows: ott.length, actor_videos: act.length, actor_romance: act.filter(x => x.endsWith("2")).length, actor_fancams: act.filter(x => x.endsWith("3")).length, music_fancams: fan.length, jp_music: listJ.length, jp_actor_videos: actJ.length, jp_actor_kinds: Object.fromEntries([..."rfemo"].map(k => [k, actJ.filter(x => x[11] === k).length])), jp_fancams: fanJ.length, jp_only: jpo.length, jp_travel_first: welcome.length, jp_reco: reco.length, jp_top: top.length, pinned: pin.length, jp_last: lastJ.length }));
