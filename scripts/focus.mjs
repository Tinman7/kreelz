// Focus artist (per David 2026-11-12: "내가 얘기할 때까지 아일릿 원희 위주로 … 가장 앞에"): scripts/focus.json names who.
//   node scripts/focus.mjs index.html — every Music / Shows clip on the site whose title names her (and ILLIT, a show or an
//   ad of hers — other people are called 원희 too) → const PRIO_FOCUS (ids) and PRIO_FOCUS_CFG ("region~first ids~rx~ctx"
//   so the app can also spot the daytime clips of live.js). The app (focusUp) puts up to 8 of them first in All, Music
//   and Shows of that edition: the "first" ids, then the rest in the tab's own order, a different start each day.
// digest.mjs imports focusOf() to make her the day's no.1 on the Japanese digest.
import fs from "node:fs";
import zlib from "node:zlib";

export const FOCUS = (() => { try { const f = JSON.parse(fs.readFileSync("scripts/focus.json", "utf8")); return f.on ? f : null; } catch (e) { return null; } })();
const RX = FOCUS ? new RegExp(FOCUS.rx, "i") : null, CTX = FOCUS ? new RegExp(FOCUS.ctx, "i") : null;
/** is this clip about the focus artist? (title, channel, tags) */
export const focusOf = (title, channel, tags) => !!FOCUS && RX.test(String(title || "")) && CTX.test(`${title || ""} ${channel || ""} ${Array.isArray(tags) ? tags.join(" ") : tags || ""}`);

if (import.meta.url === `file://${process.argv[1]}`) {
  const site = process.argv[2] || "index.html"; let h = fs.readFileSync(site, "utf8");
  if (!/const PRIO_FOCUS = "[^"]*";/.test(h)) { console.log("focus: no PRIO_FOCUS in", site); process.exit(0); }
  let vm = {}; try { vm = JSON.parse(zlib.gunzipSync(fs.readFileSync("data/vmeta.json.gz"))); } catch (e) {}
  const ids = [];
  if (FOCUS) for (const name of ["FEED", "SHORTS"]) { const s = (new RegExp(`const ${name} = "([^"]*)"`).exec(h) || [])[1] || "";
    for (let i = 0; i + 16 <= s.length; i += 16) { const id = s.slice(i, i + 11), c = s[i + 11].toLowerCase(), m = vm[id];
      if ("me".includes(c) && m && focusOf(m[0], m[2], m[5])) ids.push(id); } }
  const cfg = FOCUS ? [FOCUS.region || "", (FOCUS.first || []).join(","), FOCUS.rx, FOCUS.ctx].join("~").replace(/["\\]/g, "") : "";
  h = h.replace(/const PRIO_FOCUS = "[^"]*";/, () => `const PRIO_FOCUS = "${[...new Set(ids)].join("")}";`).replace(/const PRIO_FOCUS_CFG = "[^"]*";/, () => `const PRIO_FOCUS_CFG = "${cfg}";`);
  fs.writeFileSync(site, h); console.log("focus:", FOCUS ? FOCUS.name : "off", ids.length, "clips");
}
