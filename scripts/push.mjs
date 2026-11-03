// Daily push notification (per David 2026-11-03): every morning at 08:00 local time, "today in 3 minutes" to the
// browsers that turned on the alert — Japanese at 08:00 JST for the Japan edition, English at 08:00 PHT for kreelz.com.
// The text comes from data/digest.json (the day's Top 10). Subscriptions are read from Supabase with PUSH_TOKEN
// (setup/push.sql); browsers that are gone are removed. usage:
//   VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... PUSH_TOKEN=... node scripts/push.mjs ja|en [--test]
import fs from "node:fs";
import webpush from "web-push";

const ed = process.argv[2] === "ja" ? "ja" : "en", test = process.argv.includes("--test");
const { VAPID_PUBLIC_KEY: PUB, VAPID_PRIVATE_KEY: PRIV, PUSH_TOKEN: TOK } = process.env;
if (!PUB || !PRIV || !TOK) { console.log("push: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / PUSH_TOKEN not set yet — skipped"); process.exit(0); }
webpush.setVapidDetails("mailto:kreelzkorea@gmail.com", PUB, PRIV);
const h = fs.readFileSync("index.html", "utf8");
const SB_URL = (h.match(/const SB_URL = "([^"]+)"/) || [])[1], SB_KEY = (h.match(/const SB_KEY = "([^"]+)"/) || [])[1];
const rpc = async (fn, body) => { const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${fn}: ${r.status} ${(await r.text()).slice(0, 200)}`); const t = await r.text(); return t ? JSON.parse(t) : null; };

const D = JSON.parse(fs.readFileSync("data/digest.json", "utf8"));
const LAST_JP = /백일의 ?거짓말|100일의 ?거짓말|100 ?Days of Deception|百日の嘘|100日の嘘|닥터 ?X|Doctor ?X|ドクター ?X/i;   // /jp rule
const items = (D.items || []).filter(x => ed !== "ja" || !LAST_JP.test(`${x.t || ""} ${x.ja_title} ${x.en_title}`));
if (!items.length) { console.log("push: no digest today"); process.exit(0); }
const top = items[0], n = items.length - 1;
const msg = ed === "ja"
  ? { title: "📰 3分でわかる今日の韓国エンタメ", body: `${top.ja_title}${n > 0 ? ` ほか${n}本` : ""}`, url: "/jp/k/today/?source=push", icon: "/icons/jp-icon-192.png" }
  : { title: "📰 Today in K-entertainment, in 3 minutes", body: `${top.en_title}${n > 0 ? ` + ${n} more` : ""}`, url: "/k/today/?source=push", icon: "/icons/icon-192.png" };
msg.tag = "kz-daily-" + D.date;
const subs = await rpc("push_targets", { tok: TOK, ed });
const sent = [], gone = []; let failed = 0;
for (const s of (test ? subs.slice(0, 3) : subs) || []) {
  try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 6 * 3600, urgency: "normal" }); sent.push(s.endpoint); }
  catch (e) { if (e.statusCode === 404 || e.statusCode === 410) gone.push(s.endpoint); else { failed++; console.log("push failed:", e.statusCode || "", String(e.body || e.message).slice(0, 120)); } }
}
if (sent.length || gone.length) await rpc("push_done", { tok: TOK, sent, gone });
console.log(JSON.stringify({ edition: ed, digest: D.date, subscribers: (subs || []).length, sent: sent.length, removed: gone.length, failed, title: msg.title, body: msg.body }));
