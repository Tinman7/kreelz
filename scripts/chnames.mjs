// Channel names in English / Japanese (per David 2026-11-28: the English and Japanese pages must not show Korean): every
// Korean channel name on the site (catalog + live.js) without a usable Latin part gets an English name (official romanization
// or the channel's known English name / a short translation) and a Japanese one (katakana / translation) from Claude →
// data/chnames.json { "<Korean name>": { en, ja } }. The app falls back to the Latin part of a name. Runs after the nightly.
// usage: ANTHROPIC_API_KEY=… node scripts/chnames.mjs [--max=3000]
import fs from "node:fs";
import zlib from "node:zlib";

const MAX = +((process.argv.find(a => a.startsWith("--max=")) || "").slice(6) || 3000), AK = process.env.ANTHROPIC_API_KEY, OUT = "data/chnames.json";
const KO = /[가-힣ㄱ-ㆎ]/, latin = n => n.replace(/[가-힣ㄱ-ㆎ]+/g, " ").replace(/[[\]()（）【】|·•_\-~!?.,]+/g, " ").replace(/\s+/g, " ").trim();
const names = (() => { try { return JSON.parse(fs.readFileSync(OUT, "utf8")); } catch (e) { return {}; } })();
const all = new Set();
try { const vm = JSON.parse(zlib.gunzipSync(fs.readFileSync("data/vmeta.json.gz"))); for (const m of Object.values(vm)) if (m && KO.test(m[2] || "")) all.add(m[2]); } catch (e) {}
try { const W = {}; new Function("window", fs.readFileSync("live.js", "utf8"))(W); for (const x of [...(W.LIVE.v || []), ...(W.LIVE.s || [])]) if (KO.test(x[7] || "")) all.add(x[7]); } catch (e) {}
const todo = [...all].filter(n => !names[n] && !/[A-Za-z]{3}/.test(latin(n))).slice(0, MAX);
console.log(`chnames: ${all.size} Korean channel names, ${Object.keys(names).length} done, doing ${todo.length}`);
if (!AK || !todo.length) process.exit(0);
const SYSTEM = `You give YouTube channel names for international viewers. Each input is a Korean channel name.
"en": how English-speaking fans would see it: the channel's known English / official name if it has one (broadcasters: SBS Entertainment, KBS Kpop, MBC Drama…), otherwise the Revised Romanization of the name (e.g. 리즈시절찾기 → Rizsijeol Chatgi), short, Title Case, no Hangul.
"ja": the name for Japanese fans in katakana (or the known Japanese/English name), no Hangul.
Output ONLY JSON: {"<Korean name>": {"en": "...", "ja": "..."}, ...}`;
for (let i = 0; i < todo.length; i += 120) {
  const part = todo.slice(i, i + 120);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST",
      headers: { "x-api-key": AK, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-5-5", max_tokens: 8000, system: SYSTEM, thinking: { type: "disabled" }, messages: [{ role: "user", content: JSON.stringify(part) }] }) });
    const d = await r.json(); if (!r.ok) { console.log("Claude", r.status, JSON.stringify(d).slice(0, 200)); break; }
    const t = (d.content || []).map(c => c.text || "").join(""), o = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
    for (const n of part) { const c = o[n]; if (c && c.en && !KO.test(c.en + (c.ja || ""))) names[n] = { en: String(c.en).slice(0, 60), ja: String(c.ja || c.en).slice(0, 60) }; }
  } catch (e) { console.log("batch skipped:", e.message); }
  if (i % 1200 === 0) fs.writeFileSync(OUT, JSON.stringify(names));
}
fs.writeFileSync(OUT, JSON.stringify(names));
console.log(`chnames: ${Object.keys(names).length} names now`, Object.entries(names).slice(-3).map(([k, v]) => `${k} → ${v.en} / ${v.ja}`).join(" | "));
