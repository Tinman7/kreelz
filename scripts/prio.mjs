// Write the HYBE/BTS priority lists into the page: const PRIO_BTS / PRIO_HYBE (concatenated 11-char ids, music items only)
// usage: node scripts/prio.mjs index.html data/vmeta.json.gz
import fs from "node:fs"; import zlib from "node:zlib";
import { prio } from "./hybe.mjs";
const [site, metaPath] = process.argv.slice(2);
let h = fs.readFileSync(site, "utf8");
const M = JSON.parse(zlib.gunzipSync(fs.readFileSync(metaPath)));
const bts = [], hybe = [];
for (const n of ["SHORTS", "FEED"]) {
  const s = h.match(new RegExp(`const ${n} = "([^"]*)";`))[1];
  for (let i = 0; i + 16 <= s.length; i += 16) {
    const id = s.slice(i, i + 11), c = s[i + 11].toLowerCase();
    if (c !== "m") continue;
    const p = prio(M[id]); if (p === 2) bts.push(id); else if (p === 1) hybe.push(id);
  }
}
const line = `const PRIO_BTS = "${bts.join("")}"; const PRIO_HYBE = "${hybe.join("")}";`;
if (/const PRIO_BTS = "[^"]*"; const PRIO_HYBE = "[^"]*";/.test(h)) h = h.replace(/const PRIO_BTS = "[^"]*"; const PRIO_HYBE = "[^"]*";/, line);
else { const m = h.match(/const FEED_BUILT = "[^"]*";/); h = h.replace(m[0], m[0] + "\n" + line); }
fs.writeFileSync(site, h);
console.log(JSON.stringify({ bts: bts.length, hybe: hybe.length }));
