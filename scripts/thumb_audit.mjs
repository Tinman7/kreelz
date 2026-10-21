// One-off / weekly audit: drop every item on the site whose thumbnail is gone.
// usage: node scripts/thumb_audit.mjs index.html bad.json
import fs from "node:fs";
import { hasThumb } from "./thumbs.mjs";
const [site = "index.html", outPath = "bad.json"] = process.argv.slice(2);
const h = fs.readFileSync(site, "utf8");
const ids = name => { const s = (h.match(new RegExp(`const ${name} = "([^"]*)";`)) || [, ""])[1];
  const a = []; for (let i = 0; i + 16 <= s.length; i += 16) a.push(s.slice(i, i + 11)); return a; };
const jobs = [...ids("SHORTS").map(id => ["s", id]), ...ids("FEED").map(id => ["v", id])];
const total = jobs.length, bad = [];
let done = 0;
await Promise.all(Array.from({ length: 48 }, async () => {
  while (jobs.length) { const [k, id] = jobs.pop();
    if (!(await hasThumb(id, k))) bad.push(id);
    if (++done % 5000 === 0) console.log(done, "/", total, "bad", bad.length); }
}));
fs.writeFileSync(outPath, JSON.stringify(bad));
console.log(JSON.stringify({ checked: total, no_thumbnail: bad.length }));
