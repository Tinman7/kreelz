// "What's in this video" for Beauty and K-Travel & Food (per David 2026-11-27: clips without subtitles can't be followed abroad):
// Claude reads each clip's YouTube description (products and shades, shops and places, prices, addresses) and writes a short
// note in Japanese / English / Spanish → data/vnotes.json { id: { ja, en, es } } (clips whose description names nothing concrete
// get an empty note, so they aren't asked again). The app shows it in the player under the title. Runs after the nightly
// (.github/workflows/vnotes.yml): up to 80 clips a night, most viewed first (YouTube: 1 unit per 50 clips; Claude: a few cents).
// usage: YT_API_KEY=… ANTHROPIC_API_KEY=… node scripts/vnotes.mjs [--n=80] [--dry]
import fs from "node:fs";

const N = +((process.argv.find(a => a.startsWith("--n=")) || "").slice(4) || 80), DRY = process.argv.includes("--dry");
const KEY = process.env.YT_API_KEY, AK = process.env.ANTHROPIC_API_KEY, OUT = "data/vnotes.json";
const h = fs.readFileSync("index.html", "utf8");
const B = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_", dec2 = s => B.indexOf(s[0]) * 64 + B.indexOf(s[1]);
const notes = (() => { try { return JSON.parse(fs.readFileSync(OUT, "utf8")); } catch (e) { return {}; } })();
// notes with Korean script or a missing language are written again (per David 2026-11-28: the English edition must read English, /jp Japanese)
const REDO = new Set(); for (const [id, c] of Object.entries(notes)) if (c && (/[가-힣]/.test(`${c.ja}${c.en}${c.es}`) || !c.ja || !c.en || !c.es)) { delete notes[id]; REDO.add(id); }
const rows = [];
for (const n of ["FEED", "SHORTS"]) { const s = (new RegExp(`const ${n} = "([^"]*)"`).exec(h) || [])[1] || "";
  for (let i = 0; i + 16 <= s.length; i += 16) { const id = s.slice(i, i + 11), c = s[i + 11].toLowerCase(); if ((c === "b" || c === "k") && !(id in notes)) rows.push({ id, c, v: dec2(s.slice(i + 12, i + 14)) }); } }
rows.sort((a, b) => (REDO.has(b.id) - REDO.has(a.id)) || b.v - a.v);   // the ones to write again first const pick = rows.slice(0, N);
console.log(`vnotes: ${Object.keys(notes).length} done, ${rows.length} Beauty / Travel & Food clips left, doing ${pick.length}`);
if (!KEY || !AK || !pick.length) process.exit(0);

const desc = {};
for (let i = 0; i < pick.length; i += 50) {
  const r = await (await fetch("https://www.googleapis.com/youtube/v3/videos?" + new URLSearchParams({ part: "snippet", id: pick.slice(i, i + 50).map(p => p.id).join(","), key: KEY }))).json();
  if (r.error) { console.log("YouTube:", r.error.message); break; }
  for (const v of r.items || []) desc[v.id] = { title: v.snippet.title, description: String(v.snippet.description || "").replace(/https?:\/\/\S+/g, "").replace(/\n{2,}/g, "\n").slice(0, 1500) };
}
const SYSTEM = `You write a short "what's in this video" note for international fans watching Korean beauty, food and travel videos without subtitles. For each key you get the video's title and its YouTube description.
From the material only, list what a viewer would want to know: products used (brand + product + shade), shops / restaurants / places (name, area), dishes, prices. Skip sponsorship boilerplate, social links, music credits, hashtags and anything not stated. No opinions, no guessing.
Write it as one compact line (at most 160 characters), items separated by " · ", starting with a short label — Japanese "使用アイテム：" / "登場スポット：" / "メニュー：", English "Products:" / "Places:" / "Menu:", Spanish "Productos:" / "Lugares:" / "Menú:". Never write Korean script (Hangul) anywhere: in "en" and "es" write brand, dish and place names in their usual official romanization (e.g. Gwangjang Market, tteokbokki, rom&nd); in "ja" use katakana (e.g. クァンジャン市場, トッポッキ) or the brand's usual Latin name. Every field must be filled in its own language.
Give "ja", "en" and "es". If the material names nothing concrete, use "" for all three.
Output ONLY JSON: {"<key>": {"ja": "...", "en": "...", "es": "..."}, ...}`;
const ids = Object.keys(desc); let done = 0;
for (let i = 0; i < ids.length; i += 20) {
  const part = ids.slice(i, i + 20);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST",
      headers: { "x-api-key": AK, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-5-5", max_tokens: 8000, system: SYSTEM, thinking: { type: "disabled" },
        messages: [{ role: "user", content: JSON.stringify(Object.fromEntries(part.map(id => [id, desc[id]]))) }] }) });
    const d = await r.json(); if (!r.ok) { console.log("Claude", r.status, JSON.stringify(d).slice(0, 200)); continue; }
    const t = (d.content || []).map(c => c.text || "").join(""), o = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
    for (const id of part) { const c = o[id] || {}; notes[id] = (c.ja || c.en) ? { ja: String(c.ja || "").slice(0, 200), en: String(c.en || "").slice(0, 200), es: String(c.es || "").slice(0, 200) } : 0; done++; }
  } catch (e) { console.log("batch skipped:", e.message); }
}
for (const p of pick) if (!(p.id in desc) && !(p.id in notes)) notes[p.id] = 0;   // gone / private: don't ask again
const filled = Object.values(notes).filter(Boolean).length;
console.log(`vnotes: ${done} written now; ${filled} with a note in all`, Object.entries(notes).filter(([, c]) => c).slice(-3).map(([id, c]) => `${id} ${c.en}`).join(" | "));
if (!DRY) fs.writeFileSync(OUT, JSON.stringify(notes));
