// Write the Music priority list into the page: const PRIO_LIST = "<11-char id><rank char>..." (music items only)
// usage: node scripts/prio.mjs index.html data/vmeta.json.gz
import fs from "node:fs"; import zlib from "node:zlib";
import { rank, ARTISTS, EXTRA_MALE, FANCAM_M, JP_ARTISTS, rankIn } from "./hybe.mjs";
import { actorScore, JP_ACTORS, actorScoreIn } from "./actors.mjs";
const [site, metaPath] = process.argv.slice(2);
let h = fs.readFileSync(site, "utf8");
const M = JSON.parse(zlib.gunzipSync(fs.readFileSync(metaPath)));
const RC = "123456789abcdefghijklmnopqrstuvwxyz";
// Japan edition: videos only shown on /jp (scripts/japan.mjs), and the Japan channels of the priority artists
const JPO = new Set(fs.existsSync("data/jp_only.json") ? JSON.parse(fs.readFileSync("data/jp_only.json", "utf8")) : []);
try { for (const c of JSON.parse(fs.readFileSync("scripts/jp_channels.json", "utf8")).channels) {
  const a = c.id && c.artist && JP_ARTISTS.find(x => x[0] === c.artist); if (a && !a[1].includes(c.id)) a[1].push(c.id); } } catch (e) {}
const jpo = [];
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
    { const m = M[s.slice(i, i + 11)]; if (m && LAST_JP.test(m[0] + " " + (m[5] || []).join(" "))) lastJ.push(s.slice(i, i + 11)); }
    if ("dfe".includes(cc)) { const m = M[s.slice(i, i + 11)]; if (m && ((OTT.test(m[2]) && !OTT_NOT.test(m[2])) || JPO.has(s.slice(i, i + 11)))) ott.push(s.slice(i, i + 11));
      const sc = actorScore(m) || (rank(m) ? 1 : 0);   // priority idols' interviews / TV appearances join the focus pool
      if (sc) act.push(s.slice(i, i + 11) + sc);
      const scJ = actorScoreIn(JP_ACTORS, m) || (rankIn(JP_ARTISTS, m) ? 1 : 0);
      if (scJ) actJ.push(s.slice(i, i + 11) + scJ); continue; }
    if (cc !== "m") continue;
    const id = s.slice(i, i + 11), m = M[id], text = m ? m[0] + " " + (m[5] || []).join(" ") : "";
    let r = rank(m); const cam = !!m && FANCAM_M.test(text);
    if (!r && cam && EXTRA_MALE.some(a => a[2].test(text))) r = ARTISTS.length + 1;   // other boy groups' fancams: right after the list
    const rJ = rankIn(JP_ARTISTS, m) || (JPO.has(id) ? JP_ARTISTS.length + 1 : 0);   // other Japan-channel music right after the list
    if (rJ) { listJ.push(id + RC[rJ - 1]); if (cam) fanJ.push(id); }
    if (r) { list.push(id + RC[r - 1]); const nm = ARTISTS[r - 1] ? ARTISTS[r - 1][0] : "other boy groups"; counts[nm] = (counts[nm] || 0) + 1; if (cam) fan.push(id); }
  }
}
const line = `const PRIO_LIST = "${list.join("")}"; const PRIO_OTT = "${ott.join("")}"; const PRIO_ACT = "${act.join("")}"; const PRIO_FAN = "${fan.join("")}"; const PRIO_LIST_JP = "${listJ.join("")}"; const PRIO_ACT_JP = "${actJ.join("")}"; const PRIO_FAN_JP = "${fanJ.join("")}"; const PRIO_JPO = "${jpo.join("")}"; const PRIO_LAST_JP = "${lastJ.join("")}";`;
h = h.replace(/const PRIO_BTS = "[^"]*"; const PRIO_HYBE = "[^"]*";/, line);
h = h.replace(/ const PRIO_OTT = "[^"]*";/, "").replace(/ const PRIO_ACT = "[^"]*";/, "").replace(/ const PRIO_FAN = "[^"]*";/, "")
  .replace(/ const PRIO_LIST_JP = "[^"]*";/, "").replace(/ const PRIO_ACT_JP = "[^"]*";/, "").replace(/ const PRIO_FAN_JP = "[^"]*";/, "").replace(/ const PRIO_JPO = "[^"]*";/, "").replace(/ const PRIO_LAST_JP = "[^"]*";/, "");
if (/const PRIO_LIST = "[^"]*";/.test(h)) h = h.replace(/const PRIO_LIST = "[^"]*";/, line);
else { const m = h.match(/const FEED_BUILT = "[^"]*";/); h = h.replace(m[0], m[0] + "\n" + line); }
fs.writeFileSync(site, h);
console.log(JSON.stringify({ ...counts, OTT_screen_shows: ott.length, actor_videos: act.length, actor_romance: act.filter(x => x.endsWith("2")).length, actor_fancams: act.filter(x => x.endsWith("3")).length, music_fancams: fan.length, jp_music: listJ.length, jp_actor_videos: actJ.length, jp_fancams: fanJ.length, jp_only: jpo.length, jp_last: lastJ.length }));
