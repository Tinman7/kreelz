// Google Search Console numbers for the admin page (per David 2026-11-02): impressions, clicks, CTR and position per day
// (whole site and the Japan edition), top pages, queries and countries of the last 28 days. Read with a Google Cloud
// service account that David added to the Search Console property (read-only); its JSON key is the GitHub secret GSC_KEY.
// Writes data/gsc.json. Search Console data lags 2–3 days. usage: GSC_KEY='{…}' [GSC_SITE=https://kreelz.com/] node scripts/gsc.mjs
import fs from "node:fs";
import crypto from "node:crypto";

const OUT = "data/gsc.json";
const raw = process.env.GSC_KEY;
if (!raw) { console.log("gsc: no GSC_KEY secret yet — skipped"); process.exit(0); }
let key; try { key = JSON.parse(raw); } catch { console.log("gsc: GSC_KEY is not valid JSON — skipped"); process.exit(0); }
const b64u = b => Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
async function token() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64u(JSON.stringify({ iss: key.client_email, scope: "https://www.googleapis.com/auth/webmasters.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = crypto.createSign("RSA-SHA256").update(`${head}.${claim}`).sign(key.private_key);
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claim}.${b64u(sig)}` }) });
  const d = await r.json(); if (!d.access_token) throw new Error("token: " + JSON.stringify(d).slice(0, 200)); return d.access_token;
}
const tok = await token();
const day = n => new Date(Date.now() + 9 * 3600e3 - n * 864e5).toISOString().slice(0, 10);
const range = { startDate: day(30), endDate: day(1) };
async function q(site, body) {
  const r = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
    method: "POST", headers: { authorization: "Bearer " + tok, "content-type": "application/json" }, body: JSON.stringify({ ...range, ...body }) });
  const d = await r.json(); if (d.error) throw new Error(`${site}: ${d.error.code} ${d.error.message}`); return d.rows || [];
}
// the property: GSC_SITE, else whichever of these the service account can read
let site = process.env.GSC_SITE || "";
if (!site) for (const s of ["https://kreelz.com/", "sc-domain:kreelz.com", "https://www.kreelz.com/"]) { try { await q(s, { dimensions: ["date"], rowLimit: 1 }); site = s; break; } catch (e) { console.log("not", s, e.message.slice(0, 400)); } }
if (!site) { console.log("gsc: the service account cannot read the kreelz.com property — add its e-mail in Search Console > Settings > Users and permissions"); process.exit(0); }
const jp = [{ filters: [{ dimension: "page", operator: "contains", expression: "kreelz.com/jp" }] }];
const row = r => ({ k: r.keys ? r.keys[0] : "", imp: r.impressions, clk: r.clicks, ctr: Math.round(r.ctr * 1000) / 10, pos: Math.round(r.position * 10) / 10 });
const out = {
  updated: new Date().toISOString(), site, from: range.startDate, to: range.endDate,
  days: (await q(site, { dimensions: ["date"] })).map(row),
  jpDays: (await q(site, { dimensions: ["date"], dimensionFilterGroups: jp })).map(row),
  pages: (await q(site, { dimensions: ["page"], rowLimit: 25 })).map(row),
  queries: (await q(site, { dimensions: ["query"], rowLimit: 25 })).map(row),
  jpQueries: (await q(site, { dimensions: ["query"], rowLimit: 15, dimensionFilterGroups: jp })).map(row),
  countries: (await q(site, { dimensions: ["country"], rowLimit: 15 })).map(row),
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
const sum = l => l.reduce((a, r) => a + r.imp, 0);
console.log(`gsc ${site} ${range.startDate}..${range.endDate}: impressions ${sum(out.days)} (jp ${sum(out.jpDays)}), clicks ${out.days.reduce((a, r) => a + r.clk, 0)}`);
