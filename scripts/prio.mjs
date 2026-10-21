// Write the Music priority list into the page: const PRIO_LIST = "<11-char id><rank char>..." (music items only)
// usage: node scripts/prio.mjs index.html data/vmeta.json.gz
import fs from "node:fs"; import zlib from "node:zlib";
import { rank, ARTISTS } from "./hybe.mjs";
const [site, metaPath] = process.argv.slice(2);
let h = fs.readFileSync(site, "utf8");
const M = JSON.parse(zlib.gunzipSync(fs.readFileSync(metaPath)));
const RC = "123456789abcdefghijklmnopqrstuvwxyz";
const list = [], counts = {};
for (const n of ["SHORTS", "FEED"]) {
  const s = h.match(new RegExp(`const ${n} = "([^"]*)";`))[1];
  for (let i = 0; i + 16 <= s.length; i += 16) {
    if (s[i + 11].toLowerCase() !== "m") continue;
    const id = s.slice(i, i + 11), r = rank(M[id]);
    if (r) { list.push(id + RC[r - 1]); counts[ARTISTS[r - 1][0]] = (counts[ARTISTS[r - 1][0]] || 0) + 1; }
  }
}
const line = `const PRIO_LIST = "${list.join("")}";`;
h = h.replace(/const PRIO_BTS = "[^"]*"; const PRIO_HYBE = "[^"]*";/, line);
if (/const PRIO_LIST = "[^"]*";/.test(h)) h = h.replace(/const PRIO_LIST = "[^"]*";/, line);
else { const m = h.match(/const FEED_BUILT = "[^"]*";/); h = h.replace(m[0], m[0] + "\n" + line); }
fs.writeFileSync(site, h);
console.log(JSON.stringify(counts));
