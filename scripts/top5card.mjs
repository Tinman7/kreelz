// TOP5 card for X, one tap (per David 2026-11-11: "탑5도 … 내가 누르면 포스팅만 할 수 있게"). X's post link can't attach an
// image, but a link's preview can be one: this draws today's TOP5 (data/xposts.json "card", the same list as the admin
// TOP5 card) as a 1200×628 picture → jp/top5.png, and writes jp/top5/index.html whose og:image / twitter:card is that picture
// (a person who opens the link goes on to kreelz.com/jp). The admin's "X에 올리기" puts kreelz.com/jp/top5/?d=MMDD in the
// post, so X shows the card under the text. Runs after the nightly (.github/workflows/top5card.yml) — needs Chromium
// (playwright) and Japanese fonts.
import fs from "node:fs";
import { chromium } from "playwright";

const d = JSON.parse(fs.readFileSync("data/xposts.json", "utf8")), c = d.card;
if (!c || !c.rows || !c.rows.length) { console.log("top5card: no card today"); process.exit(0); }
const html = `<!doctype html><meta charset="utf-8"><body style="margin:0"><canvas id="c" width="1200" height="628"></canvas><script>
const c=${JSON.stringify(c)}, W=1200, H=628, g=document.getElementById("c").getContext("2d");
const F='"Noto Sans CJK JP","Noto Sans JP","Noto Color Emoji",sans-serif', AC="#E8445A", INK="#111318", MU="#7A808C";
const fit=(t,max)=>{ if(g.measureText(t).width<=max) return t; let s=[...t]; while(s.length && g.measureText(s.join("")+"…").width>max) s.pop(); return s.join("")+"…" };
const fmt=v=>v>=1e6?(v/1e6).toFixed(1).replace(/\\.0$/,"")+"M":v>=1e3?Math.round(v/1e3)+"K":String(v);
g.fillStyle="#fff"; g.fillRect(0,0,W,H); g.fillStyle=AC; g.fillRect(0,0,W,10);
g.beginPath(); g.arc(62,58,9,0,7); g.fill();
g.textBaseline="middle"; g.fillStyle=INK; g.font="800 30px "+F; g.fillText("KREELZ JAPAN",80,59);
g.fillStyle=MU; g.font="600 26px "+F; g.textAlign="right"; g.fillText(c.date||"",W-56,59); g.textAlign="left";
g.textBaseline="alphabetic"; g.fillStyle=INK; g.font="900 76px "+F; g.fillText("TOP 5",54,158);
g.fillStyle=AC; g.font="800 28px "+F; g.fillText(fit(c.title||"韓国で今日いちばん見られている",W-300),300,150);
const rows=c.rows.slice(0,5); let y=196;
rows.forEach((r,i)=>{ g.strokeStyle="#ECEEF2"; g.lineWidth=2; g.beginPath(); g.moveTo(54,y); g.lineTo(W-54,y); g.stroke();
  g.fillStyle=AC; g.font="900 44px "+F; g.textBaseline="top"; g.fillText(String(i+1),58,y+12);
  g.fillStyle=INK; g.font="700 28px "+F; g.fillText(fit(r.t,W-110-56),110,y+10);
  g.fillStyle=MU; g.font="500 19px "+F; g.fillText(fit((r.ch||"").trim()+(r.v>0?" · "+fmt(r.v)+" views":""),W-110-56),110,y+46);
  g.textBaseline="alphabetic"; y+=76 });
g.fillStyle=INK; g.font="800 24px "+F; g.fillText("▶ "+(c.url||"kreelz.com/jp"),56,H-26);
g.fillStyle=MU; g.font="600 20px "+F; g.textAlign="right"; g.fillText(c.foot||"リアルタイム更新",W-56,H-27);
window.PNG=document.getElementById("c").toDataURL("image/png");
</script>`;
const b = await chromium.launch(), pg = await b.newPage();
await pg.setContent(html); await pg.evaluate(() => document.fonts.ready);
await pg.waitForFunction(() => window.PNG);
const png = Buffer.from((await pg.evaluate(() => window.PNG)).split(",")[1], "base64");
await b.close();
fs.mkdirSync("jp/top5", { recursive: true });
fs.writeFileSync("jp/top5.png", png);
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const ver = (d.date || "").replace(/-/g, ""), title = `韓国で今日いちばん見られているK動画 TOP5（${c.date}）`,
  desc = c.rows.slice(0, 5).map((r, i) => `${i + 1}. ${r.t}`).join(" / ").slice(0, 280);
fs.writeFileSync("jp/top5/index.html", `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | KREELZ JAPAN</title>
<meta name="description" content="${esc(desc)}"><link rel="canonical" href="https://kreelz.com/jp/">
<meta property="og:type" content="website"><meta property="og:site_name" content="KREELZ JAPAN"><meta property="og:locale" content="ja_JP">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="https://kreelz.com/jp/top5/"><meta property="og:image" content="https://kreelz.com/jp/top5.png?v=${ver}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="628">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="https://kreelz.com/jp/top5.png?v=${ver}">
<meta name="robots" content="noindex,follow"><meta http-equiv="refresh" content="0;url=/jp/">
</head><body><p><a href="/jp/">KREELZ JAPAN — ${esc(title)}</a></p><script>location.replace("/jp/")</script></body></html>
`);
console.log("top5card:", d.date, png.length, "bytes");
