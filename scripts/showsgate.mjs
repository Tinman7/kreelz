// Shows tab clean-up (per David 2026-11-27: "케이팝 가수들이나 지금 화제가 되는 드라마의 유명한 배우들을 제외하고서는 그 쓸데없는
// 엔터테인먼트 콘텐츠 다 없애버리고"): variety ("e") clips stay only when
//   - a K-pop artist from the site's lists (scripts/hybe.mjs) or a well-known actor (scripts/actors.mjs, scripts/shows_stars.json) is in it,
//   - or it has real subtitles (data/captions.json) or comes from a channel that subtitles for fans abroad (KBS WORLD TV …),
//   - or it is a TVING Original (kept on purpose: TVING can't be watched outside Korea).
// Pins, the front list, held clips and clips David sent (konbini ids) are never dropped.
// usage: node scripts/showsgate.mjs index.html [--dry]   (nightly, after captions); showOk() is used by the daytime finds too
import fs from "node:fs";
import zlib from "node:zlib";
import { ARTISTS, JP_ARTISTS, EXTRA_MALE } from "./hybe.mjs";
import { ACTORS, JP_ACTORS } from "./actors.mjs";

let EXTRA = []; try { EXTRA = JSON.parse(fs.readFileSync(new URL("./shows_stars.json", import.meta.url), "utf8")).names || []; } catch (e) {}
const RX = [...ARTISTS, ...JP_ARTISTS, ...EXTRA_MALE, ...ACTORS, ...JP_ACTORS].map(a => a[2]).concat(EXTRA.map(s => new RegExp(s, "i")));
export const SUB_CH = /kbs world|arirang|kocowa|viki|netflix k-?content|tving global|mnet k-?pop|kbs kpop|1thek|dingo|studio choom/i;
export const hasStar = text => RX.some(r => r.test(text));
/** a variety clip worth keeping on the Shows tab? */
export const showOk = (title, chName, tags, opts = {}) =>
  hasStar(`${title || ""} ${chName || ""} ${Array.isArray(tags) ? tags.join(" ") : tags || ""}`) || SUB_CH.test(chName || "") || !!opts.captions || !!opts.tving;

if (import.meta.url === `file://${process.argv[1]}`) {
  const site = process.argv[2] || "index.html", DRY = process.argv.includes("--dry");
  let h = fs.readFileSync(site, "utf8");
  const vm = (() => { try { return JSON.parse(zlib.gunzipSync(fs.readFileSync("data/vmeta.json.gz"))); } catch (e) { return {}; } })();
  const cap = (() => { try { return JSON.parse(fs.readFileSync("data/captions.json", "utf8")); } catch (e) { return {}; } })();
  const str = n => (new RegExp(`const ${n} = "([^"]*)"`).exec(h) || [])[1] || "";
  const ids11 = s => { const o = new Set(); for (let i = 0; i + 11 <= s.length; i += 11) o.add(s.slice(i, i + 11)); return o; };
  let unpack = s => s; try { const m = await import("./packlists.mjs"); if (m.unpackList) unpack = n => m.unpackList(h, n); } catch (e) {}
  const TVO = ids11(typeof unpack("PRIO_TVO") === "string" && !unpack("PRIO_TVO").startsWith("~") ? unpack("PRIO_TVO") : str("PRIO_TVO"));
  const keep = new Set();
  try { const L = {}; new Function("window", fs.readFileSync("live.js", "utf8"))(L); const W = L.LIVE || {};
    for (const k of ["pin", "hold"]) for (const id of ((W[k] || {}).ids || [])) keep.add(id);
    for (const id of (String(W.front || "").split("|")[1] || "").match(/.{11}/g) || []) keep.add(id); } catch (e) {}
  try { const K = JSON.parse(fs.readFileSync("scripts/konbini.json", "utf8")); for (const g of (K.groups || K)) for (const id of g.ids || []) keep.add(id); } catch (e) {}
  const out = {}, drops = [];
  for (const n of ["FEED", "SHORTS"]) {
    const s = str(n); let o = "";
    for (let i = 0; i + 16 <= s.length; i += 16) { const row = s.slice(i, i + 16), id = row.slice(0, 11);
      if (row[11] === "e" && !keep.has(id)) { const m = vm[id];
        if (m && !showOk(m[0], m[2], m[5], { captions: cap[id] === 1, tving: TVO.has(id) })) { drops.push(id); continue; } }
      o += row; }
    out[n] = o;
  }
  const e = n => (str(n).match(/.{16}/g) || []).filter(r => r[11] === "e").length;
  console.log(`showsgate: Shows clips ${e("FEED")} videos + ${e("SHORTS")} shorts → dropping ${drops.length}`);
  console.log(drops.slice(0, 12).map(id => `  - ${vm[id][2]} | ${vm[id][0].slice(0, 60)}`).join("\n"));
  // live.js (clips found during the day): the same rule
  let liveDrop = 0;
  try { const src = fs.readFileSync("live.js", "utf8"), L = {}; new Function("window", src)(L); const W = L.LIVE;
    if (W && Array.isArray(W.v)) { const f = x => x[1] !== "e" || keep.has(x[0]) || showOk(x[6], x[7], "", { captions: cap[x[0]] === 1, tving: TVO.has(x[0]) });
      const v = W.v.filter(f), s2 = W.s.filter(f); liveDrop = W.v.length + W.s.length - v.length - s2.length;
      if (!DRY && liveDrop) { W.v = v; W.s = s2; fs.writeFileSync("live.js", "window.LIVE=" + JSON.stringify(W) + ";\n"); } } } catch (e) { console.log("live.js:", e.message); }
  console.log(`showsgate: live.js dropping ${liveDrop}`);
  if (!DRY && drops.length) { for (const n of ["FEED", "SHORTS"]) h = h.replace(new RegExp(`const ${n} = "[^"]*"`), () => `const ${n} = "${out[n]}"`); fs.writeFileSync(site, h); }
}
