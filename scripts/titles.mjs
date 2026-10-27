// KREELZ — titles in every site language, prepared on the server.
// usage: YT_API_KEY=... ANTHROPIC_API_KEY=... node scripts/titles.mjs index.html
// 1) every video id on the site gets its original title + channel from the YouTube Data API (videos.list, 1 unit per 50)
// 2) every original title is translated by Claude into en, tl, th, id, es
// Output (served with the site, loaded by the page in small shards):
//   t/o/<xx>.json   {id: [title, channel]}
//   t/<lang>/<xx>.json   {id: translated title}
//   t/gone.json   ids YouTube no longer returns (deleted or private)
import fs from "node:fs";
import path from "node:path";

const YT = process.env.YT_API_KEY, AK = process.env.ANTHROPIC_API_KEY;
if (!YT) { console.error("YT_API_KEY is required"); process.exit(1); }
if (!AK) console.log("ANTHROPIC_API_KEY missing: original titles only, no translations");
const site = process.argv[2] || "index.html";
const MODEL = process.env.TX_MODEL || "claude-haiku-5-5";
const MAX_OUT = +(process.env.TX_MAX_OUTPUT_TOKENS || 15_000_000);   // spend guard per run
const DEADLINE = Date.now() + (+(process.env.TX_MINUTES || 150)) * 60_000;
const LANGS = ["en", "tl", "th", "id", "es"];   // translated together (pass B)
const PAR = +(process.env.TX_PAR || 6);          // Claude calls at a time
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const shard = id => ((B64.indexOf(id[0]) * 64 + B64.indexOf(id[1])) % 256).toString(16).padStart(2, "0");
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- ids on the site
const h = fs.readFileSync(site, "utf8");
const ids = [];
for (const name of ["SHORTS", "FEED"]) {
  const s = (h.match(new RegExp(`const ${name} = "([^"]*)";`)) || [, ""])[1];
  for (let i = 0; i + 16 <= s.length; i += 16) ids.push(s.slice(i, i + 11));
}
const site_ids = [...new Set(ids)];

// ---- existing store
const dirs = ["o", ...LANGS, "ja"], store = {};   // ja: Japanese edition (kreelz.com/jp), its own pass (pass A)
for (const d of dirs) {
  store[d] = {};
  for (let n = 0; n < 256; n++) {
    const f = `t/${d}/${n.toString(16).padStart(2, "0")}.json`;
    if (fs.existsSync(f)) Object.assign(store[d], JSON.parse(fs.readFileSync(f, "utf8")));
  }
}
const gone = new Set(fs.existsSync("t/gone.json") ? JSON.parse(fs.readFileSync("t/gone.json", "utf8")) : []);

// ---- 1) original titles from YouTube
const needMeta = site_ids.filter(id => !store.o[id] && !gone.has(id));
let ytCalls = 0;
async function ytBatch(batch) {
  for (let t = 0; t < 4; t++) {
    const r = await fetch("https://www.googleapis.com/youtube/v3/videos?" + new URLSearchParams({ key: YT, part: "snippet", id: batch.join(","), maxResults: 50 }));
    const d = await r.json().catch(() => ({}));
    if (!d.error) {
      ytCalls++;
      const seen = new Set();
      for (const v of d.items || []) { seen.add(v.id); store.o[v.id] = [v.snippet.title || "", v.snippet.channelTitle || ""]; }
      batch.forEach(id => { if (!seen.has(id)) gone.add(id); });
      return;
    }
    if (/quota/i.test(JSON.stringify(d.error))) throw new Error("YouTube quota reached");
    await sleep(2000 * (t + 1));
  }
}
{
  const batches = []; for (let i = 0; i < needMeta.length; i += 50) batches.push(needMeta.slice(i, i + 50));
  await Promise.all(Array.from({ length: 4 }, async () => { while (batches.length) await ytBatch(batches.pop()); }));
}

// ---- 2) translations with Claude
const SYSTEM = `You translate titles of Korean entertainment videos (K-pop, K-drama, film, variety shows, beauty, food) for international fans.
For every input title return natural, concise translations in: en (English), tl (Tagalog/Filipino), th (Thai), id (Indonesian), es (Spanish).
Rules:
- Keep names of people, groups, shows, films, channels and brands in their usual official romanized/English form (e.g. 나 혼자 산다 → I Live Alone, 런닝맨 → Running Man, 아이브 → IVE). Never translate a name literally.
- Keep emojis, #hashtags, numbers, episode markers like [EP.12] and punctuation style. Keep text already in the target language as it is.
- Do not add explanations, quotes or extra words. Keep it about as long as the original.
- Output ONLY a JSON object: {"<key>": {"en": "...", "tl": "...", "th": "...", "id": "...", "es": "..."}, ...} with exactly the keys you were given.`;
let outTok = 0, inTok = 0, calls = 0, failedBatches = 0, logged = 0, stopTx = false;
const SYSTEM_JA = `You translate titles of Korean entertainment videos (K-pop, K-drama, film, variety shows, beauty, food, travel) into natural Japanese for Japanese fans.
Rules:
- Use the names Japanese fans use: Korean people in katakana with a middle dot between family and given name (차은우 → チャ・ウヌ, 변우석 → ビョン・ウソク); groups and brands in their usual Latin form (BTS, IVE, SEVENTEEN, Olive Young); dramas, films and shows by their official Japanese title when one is widely used (나 혼자 산다 → 私は一人で暮らす, 런닝맨 → ランニングマン), otherwise a natural Japanese rendering.
- Keep emojis, #hashtags, numbers, episode markers like [EP.12] and the punctuation style. A title already in Japanese stays as it is.
- Do not add explanations, quotes or extra words. Keep it about as long as the original.
- Output ONLY a JSON object: {"<key>": "<Japanese title>", ...} with exactly the keys you were given.`;
async function claude(items, system = SYSTEM) {
  const user = JSON.stringify(Object.fromEntries(items.map((it, k) => [String(k), it.t])));
  for (let t = 0; t < 6; t++) {
    let r;
    try {
      r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": AK, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: MODEL, max_tokens: 16000, system, messages: [{ role: "user", content: user }],
          ...(process.env.TX_NO_THINKING === "0" ? {} : { thinking: { type: "disabled" } }) }),   // plain translation: no thinking tokens
      });
    } catch (e) { if (logged++ < 8) console.log("fetch failed:", e.message); await sleep(3000 * (t + 1)); continue; }
    if (r.status === 429 || r.status >= 500) { if (logged++ < 8) console.log("Claude API", r.status, (await r.text().catch(() => "")).slice(0, 300));
      await sleep((+(r.headers.get("retry-after") || 0) * 1000) || 4000 * (t + 1)); continue; }
    const d = await r.json();
    if (!r.ok) { console.log("Claude API " + r.status + ": " + JSON.stringify(d.error || d).slice(0, 300) + " — translation stopped, saving what is done");
      stopTx = true; return null; }   // e.g. credit balance too low: keep everything translated so far
    calls++; inTok += d.usage?.input_tokens || 0; outTok += d.usage?.output_tokens || 0;
    let txt = (d.content || []).map(c => c.text || "").join("").trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
    const a = txt.indexOf("{"), b = txt.lastIndexOf("}");
    try { return JSON.parse(txt.slice(a, b + 1)); } catch (e) { if (logged++ < 8) console.log("unreadable answer:", e.message, txt.slice(0, 300)); if (t >= 1) return null; }
  }
  return null;
}
// Japan-only videos (scripts/japan.mjs) are shown only on kreelz.com/jp, already in Japanese: no translation needed
const jpOnly = new Set(fs.existsSync("data/jp_only.json") ? JSON.parse(fs.readFileSync("data/jp_only.json", "utf8")) : []);
for (const id of jpOnly) if (store.o[id] && store.o[id][0]) store.ja[id] = store.o[id][0];   // already Japanese
for (const id of site_ids) { const t = store.o[id] && store.o[id][0]; if (t && !store.ja[id] && /[ぁ-んァ-ヶ]/.test(t)) store.ja[id] = t; }   // titles already written in Japanese
// pass A — Japanese first (kreelz.com/jp shows these; phones have no built-in translator)
const todoJa = AK ? site_ids.filter(id => !jpOnly.has(id) && store.o[id] && store.o[id][0] && !store.ja[id]) : [];
let doneJa = 0;
{ const q = []; for (let i = 0; i < todoJa.length; i += 50) q.push(todoJa.slice(i, i + 50));
  await Promise.all(Array.from({ length: PAR }, async () => {
    while (q.length && !stopTx && outTok < MAX_OUT && Date.now() < DEADLINE) {
      const batch = q.shift();
      const res = await claude(batch.map(id => ({ id, t: store.o[id][0] })), SYSTEM_JA);
      if (!res) { failedBatches++; continue; }
      batch.forEach((id, k) => { const o = res[String(k)]; if (typeof o === "string" && o.trim()) store.ja[id] = o.trim().slice(0, 300); });
      doneJa += batch.length;
      if (doneJa % 5000 < 50) console.log(`ja ${doneJa}/${todoJa.length}  out_tokens ${outTok}`);
    }
  })); }
// pass B — the global edition's languages
const todo = AK && process.env.TX_PASSES !== "ja" ? site_ids.filter(id => !jpOnly.has(id) && store.o[id] && store.o[id][0] && LANGS.some(l => !store[l][id])) : [];
const queue = []; for (let i = 0; i < todo.length; i += 40) queue.push(todo.slice(i, i + 40));
let done = 0;
await Promise.all(Array.from({ length: PAR }, async () => {
  while (queue.length && !stopTx && outTok < MAX_OUT && Date.now() < DEADLINE) {
    const batch = queue.shift();
    const res = await claude(batch.map(id => ({ id, t: store.o[id][0] })));
    if (!res) { failedBatches++; continue; }
    batch.forEach((id, k) => {
      const o = res[String(k)]; if (!o) return;
      for (const l of LANGS) if (typeof o[l] === "string" && o[l].trim()) store[l][id] = o[l].trim().slice(0, 300);
    });
    done += batch.length;
    if (done % 4000 < 40) console.log(`translated ${done}/${todo.length}  out_tokens ${outTok}`);
  }
}));

// ---- 3) curated cards (CONTENT list): kind, blurb and title strings -> t/c/<lang>.json {text: translation}
import vm from "node:vm";
let curated = 0;
{
  const m = h.match(/const CONTENT = (\[[\s\S]*?\n\s*\]);/);
  let list = [];
  try { list = m ? vm.runInNewContext(m[1]) : []; } catch (e) { console.log("CONTENT parse failed:", e.message); }
  const texts = [...new Set(list.flatMap(it => [it.kind, it.blurb, it.title]).filter(x => typeof x === "string" && x.trim()))];
  const cmap = {};
  for (const l of LANGS) cmap[l] = fs.existsSync(`t/c/${l}.json`) ? JSON.parse(fs.readFileSync(`t/c/${l}.json`, "utf8")) : {};
  const need = AK && process.env.TX_PASSES !== "ja" ? texts.filter(x => LANGS.some(l => !cmap[l][x])) : [];
  for (let i = 0; i < need.length && !stopTx && outTok < MAX_OUT; i += 30) {
    const batch = need.slice(i, i + 30);
    const res = await claude(batch.map(t => ({ t })));
    if (!res) { failedBatches++; continue; }
    batch.forEach((x, k) => { const o = res[String(k)]; if (o) for (const l of LANGS) if (typeof o[l] === "string" && o[l].trim()) cmap[l][x] = o[l].trim(); });
    curated += batch.length;
  }
  fs.mkdirSync("t/c", { recursive: true });
  const keepT = new Set(texts);
  for (const l of LANGS) fs.writeFileSync(`t/c/${l}.json`, JSON.stringify(Object.fromEntries(Object.entries(cmap[l]).filter(([k]) => keepT.has(k)))));
}

// ---- write shards (only ids still on the site)
const keep = new Set(site_ids);
for (const d of dirs) {
  const parts = {};
  for (const [id, v] of Object.entries(store[d])) { if (!keep.has(id)) continue; (parts[shard(id)] ||= {})[id] = v; }
  fs.mkdirSync(`t/${d}`, { recursive: true });
  for (let n = 0; n < 256; n++) {
    const s = n.toString(16).padStart(2, "0"), f = path.join("t", d, s + ".json");
    const obj = parts[s] || {};
    const sorted = Object.fromEntries(Object.keys(obj).sort().map(k => [k, obj[k]]));
    fs.writeFileSync(f, JSON.stringify(sorted));
  }
}
fs.writeFileSync("t/gone.json", JSON.stringify([...gone].filter(id => keep.has(id)).sort()));
const cost = inTok / 1e6 * 0.10 + outTok / 1e6 * 0.50;
console.log(JSON.stringify({ site_ids: site_ids.length, fetched_titles: needMeta.length, youtube_calls: ytCalls, gone: gone.size,
  ja_to_translate: todoJa.length, ja_translated: doneJa, to_translate: todo.length, translated: done, curated_texts: curated, left: Math.max(0, todo.length - done), failed_batches: failedBatches,
  claude_calls: calls, input_tokens: inTok, output_tokens: outTok, approx_cost_usd: +cost.toFixed(2) }));
