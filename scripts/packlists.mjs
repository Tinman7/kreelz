// Smaller page, faster first screen (per David 2026-11-07: "첫 화면이 좀더 빨리 뜨게").
// The page carries a dozen id lists (PRIO_LIST, PRIO_CAP, PRIO_JPVAR …) that repeat ids already in FEED / SHORTS —
// about 550 KB of the 1.35 MB the browser downloads. Packed, a list says *which* FEED/SHORTS items it holds instead:
//   "~W:N:H|<bitmap>!<values>|<raw extra>"
//     W       value characters per item (0 = plain set, 1 = PRIO_LIST's artist rank / PRIO_ACT's kind, 2 = PRIO_ACTK_JP)
//     N, H    item count (base 36) and FNV-1a hash of the FEED+SHORTS ids it was packed against — if FEED or SHORTS
//             change afterwards, the hash no longer matches and the packed part is ignored (never misread)
//     bitmap  one bit per FEED item, then per SHORTS item (6 bits per base64url character)
//     values  the W characters of each item present, in the same order
//     extra   the entries whose id is not in FEED/SHORTS (live clips etc.), unchanged
// The scripts that write a list keep writing the old plain form; region.mjs packs the page right before the editions are
// built (every workflow that changes index.html runs it). The app (kzUnpack) and the scripts that read a list (str() in
// digest.mjs / seo.mjs, through unpackList here) turn both forms back into the plain one. data/lists.json.gz keeps the
// plain lists of the last pack, so a list packed against an older FEED can still be read and re-packed.
import fs from "node:fs";
import zlib from "node:zlib";

export const PACKED = { PRIO_LIST: 1, PRIO_LIST_JP: 1, PRIO_ACT: 1, PRIO_ACTK_JP: 2, PRIO_CAP: 0, PRIO_JPVAR: 0, PRIO_OTT: 0,
  PRIO_FAN: 0, PRIO_FAN_JP: 0, PRIO_JPO: 0, PRIO_LAST_JP: 0, PRIO_JPRECO: 0, PRIO_TVO: 0, PRIO_TRAVEL: 0, PRIO_FOCUS: 0 };
const SIDE = "data/lists.json.gz";
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const get = (h, n) => (new RegExp(`const ${n} = "([^"]*)"`).exec(h) || [])[1];

function base(h) {
  const F = get(h, "FEED") || "", S = get(h, "SHORTS") || "", ids = [];
  for (let i = 0; i + 16 <= F.length; i += 16) ids.push(F.slice(i, i + 11));
  for (let i = 0; i + 16 <= S.length; i += 16) ids.push(S.slice(i, i + 11));
  let x = 0x811c9dc5;
  for (const id of ids) for (let k = 0; k < 11; k++) { x ^= id.charCodeAt(k); x = Math.imul(x, 0x01000193) >>> 0; }
  const pos = new Map(); ids.forEach((id, p) => { if (!pos.has(id)) pos.set(id, p); });
  return { ids, pos, n: ids.length, h: x.toString(36) };
}
let SIDECAR; const side = () => { if (SIDECAR === undefined) { try { SIDECAR = JSON.parse(zlib.gunzipSync(fs.readFileSync(SIDE))); } catch (e) { SIDECAR = null; } } return SIDECAR; };

function decode(v, B, name) {
  const a = v.indexOf("|"), b = v.indexOf("|", a + 1), [w, n, hh] = v.slice(1, a).split(":"), W = +w, extra = v.slice(b + 1);
  if (parseInt(n, 36) !== B.n || hh !== B.h) { const s = side(); return s && s.lists && typeof s.lists[name] === "string" ? s.lists[name] : extra; }
  const body = v.slice(a + 1, b), bang = body.indexOf("!"), bits = bang < 0 ? body : body.slice(0, bang), vals = bang < 0 ? "" : body.slice(bang + 1), out = [];
  let j = 0;
  for (let c = 0; c < bits.length; c++) { const d = B64.indexOf(bits[c]); if (d <= 0) continue;
    for (let k = 0; k < 6; k++) if (d >> k & 1) { out.push(B.ids[c * 6 + k] + vals.substr(j * W, W)); j++; } }
  return out.join("") + extra;
}
function encode(raw, W, B) {
  const step = 11 + W, val = new Map(), extra = [];
  for (let i = 0; i + step <= raw.length; i += step) { const id = raw.slice(i, i + 11), p = B.pos.get(id);
    if (p === undefined) extra.push(raw.slice(i, i + step)); else { val.delete(p); val.set(p, raw.slice(i + 11, i + step)); } }
  const bits = new Uint8Array(Math.ceil(B.n / 6)); for (const p of val.keys()) bits[(p / 6) | 0] |= 1 << (p % 6);
  const ps = [...val.keys()].sort((x, y) => x - y);
  return `~${W}:${B.n.toString(36)}:${B.h}|${[...bits].map(d => B64[d]).join("")}${W ? "!" + ps.map(p => val.get(p)).join("") : ""}|${extra.join("")}`;
}

// a list from the page in its plain form (packed or not)
export function unpackList(h, name, B) { const v = get(h, name); if (v === undefined) return undefined; if (v[0] !== "~") return v; return decode(v, B || base(h), name); }

// pack every list of the page (string in, string out); writes the plain lists to data/lists.json.gz
export function packPage(h) {
  const B = base(h), lists = {}, rep = {};
  if (B.n < 1000) return { h, rep: "no FEED/SHORTS — not packed" };
  for (const [name, W] of Object.entries(PACKED)) {
    const v = get(h, name); if (v === undefined) continue;
    const raw = v[0] === "~" ? decode(v, B, name) : v;
    if (raw.length % (11 + W)) { lists[name] = raw; rep[name] = "left plain (odd length)"; continue; }
    lists[name] = raw;
    const p = encode(raw, W, B);
    if (p.length >= raw.length) { h = h.replace(new RegExp(`const ${name} = "[^"]*";`), () => `const ${name} = "${raw}";`); rep[name] = "left plain (short)"; continue; }
    if (decode(p, B, name).length !== raw.length) { rep[name] = "left plain (check failed)"; h = h.replace(new RegExp(`const ${name} = "[^"]*";`), () => `const ${name} = "${raw}";`); continue; }
    h = h.replace(new RegExp(`const ${name} = "[^"]*";`), () => `const ${name} = "${p}";`);
    rep[name] = `${raw.length} → ${p.length}`;
  }
  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync(SIDE, zlib.gzipSync(JSON.stringify({ n: B.n, h: B.h, lists })));
  SIDECAR = { n: B.n, h: B.h, lists };
  return { h, rep };
}

if (import.meta.url === `file://${process.argv[1]}`) {   // node scripts/packlists.mjs index.html
  const f = process.argv[2] || "index.html", before = fs.readFileSync(f, "utf8"), { h, rep } = packPage(before);
  fs.writeFileSync(f, h); console.log(JSON.stringify({ bytes: [before.length, h.length], rep }));
}
