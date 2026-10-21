// Write the Music priority list into the page: const PRIO_LIST = "<11-char id><rank char>..." (music items only)
// usage: node scripts/prio.mjs index.html data/vmeta.json.gz
import fs from "node:fs"; import zlib from "node:zlib";
import { rank, ARTISTS } from "./hybe.mjs";
const [site, metaPath] = process.argv.slice(2);
let h = fs.readFileSync(site, "utf8");
const M = JSON.parse(zlib.gunzipSync(fs.readFileSync(metaPath)));
const RC = "123456789abcdefghijklmnopqrstuvwxyz";
const OTT = /netflix|넷플릭스|tving|티빙|disney ?(plus|\+)|디즈니 ?(플러스|\+)|coupang ?play|쿠팡플레이|wavve|웨이브|prime ?video|watcha|왓챠/i;
const OTT_NOT = /vevo|웨이브할미|still watching|family/i;
const ott = [];
const list = [], counts = {};
for (const n of ["SHORTS", "FEED"]) {
  const s = h.match(new RegExp(`const ${n} = "([^"]*)";`))[1];
  for (let i = 0; i + 16 <= s.length; i += 16) {
    const cc = s[i + 11].toLowerCase();
    if ("dfe".includes(cc)) { const m = M[s.slice(i, i + 11)]; if (m && OTT.test(m[2]) && !OTT_NOT.test(m[2])) ott.push(s.slice(i, i + 11)); continue; }
    if (cc !== "m") continue;
    const id = s.slice(i, i + 11), r = rank(M[id]);
    if (r) { list.push(id + RC[r - 1]); counts[ARTISTS[r - 1][0]] = (counts[ARTISTS[r - 1][0]] || 0) + 1; }
  }
}
const line = `const PRIO_LIST = "${list.join("")}"; const PRIO_OTT = "${ott.join("")}";`;
h = h.replace(/const PRIO_BTS = "[^"]*"; const PRIO_HYBE = "[^"]*";/, line);
h = h.replace(/ const PRIO_OTT = "[^"]*";/, "");
if (/const PRIO_LIST = "[^"]*";/.test(h)) h = h.replace(/const PRIO_LIST = "[^"]*";/, line);
else { const m = h.match(/const FEED_BUILT = "[^"]*";/); h = h.replace(m[0], m[0] + "\n" + line); }
fs.writeFileSync(site, h);
console.log(JSON.stringify({ ...counts, OTT_screen_shows: ott.length }));
