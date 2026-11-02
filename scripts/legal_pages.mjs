// Standalone pages of the legal documents (per David 2026-11-02, for the YouTube API quota audit, which asks for
// a privacy policy URL and a terms of service URL): kreelz.com/terms/, /privacy/ and /jp/terms/, /jp/privacy/.
// Built from the same LEGAL_INFO / LEGAL / LEGAL_JA as the pop-ups in index.html, so the two never differ.
// The Japanese privacy page also carries 外部送信について (Telecommunications Business Act art. 27-12).
// usage: node scripts/legal_pages.mjs index.html
import fs from "node:fs";
import vm from "node:vm";

const h = fs.readFileSync(process.argv[2] || "index.html", "utf8");
const a = h.indexOf("const LEGAL_INFO = {"), b0 = h.indexOf("const LEGAL_JA = (()=>{");
const b = h.indexOf("\n})();", b0) + "\n})();".length;
if (a < 0 || b0 < 0) { console.log("legal blocks not found"); process.exit(1); }
const ctx = {}; vm.createContext(ctx);
vm.runInContext(h.slice(a, b) + "\nthis.R = { LEGAL_INFO, LEGAL, LEGAL_JA };", ctx);
const { LEGAL_INFO: I, LEGAL: EN, LEGAL_JA: JA } = ctx.R;
const page = (lang, doc, title, body, links) => `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · ${I.service}</title><meta name="robots" content="index,follow">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="canonical" href="https://kreelz.com${lang === "ja" ? "/jp" : ""}/${doc}/">
<style>
:root{--bg:#0f0e17;--fg:#ecebf3;--mute:#a7a5b8;--line:#2b2a3a;--acc:${lang === "ja" ? "#E2457A" : "#7c5cff"}}
@media (prefers-color-scheme: light){:root{--bg:#fff;--fg:#17161f;--mute:#5b5a6a;--line:#e3e2ea}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.7 system-ui,-apple-system,"Segoe UI",Roboto,"Hiragino Sans","Noto Sans JP",sans-serif}
main{max-width:760px;margin:0 auto;padding:28px 16px 64px}a{color:var(--acc)}
header a{font-weight:800;letter-spacing:.04em;text-decoration:none;color:var(--fg)}h1{font-size:1.6rem;line-height:1.3;margin:20px 0 4px}
.meta{color:var(--mute);font-size:.9rem;margin:0 0 24px}h4{font-size:1.05rem;margin:28px 0 6px}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:.95rem}th,td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}
th{width:30%;color:var(--mute);font-weight:600}nav{margin-top:40px;padding-top:16px;border-top:1px solid var(--line);font-size:.92rem;display:flex;gap:16px;flex-wrap:wrap}
@media (max-width:560px){th{width:38%}}
</style></head><body><main>
<header><a href="${lang === "ja" ? "/jp/" : "/"}">${I.service}${lang === "ja" ? " JAPAN" : ""}</a></header>
<h1>${title}</h1>
<p class="meta">${lang === "ja" ? `${I.service} · 第${I.version}版 · ${I.effective_ja}施行` : `${I.service} · Version ${I.version} · Effective ${I.effective}`}</p>
${body}
<nav>${links}</nav>
</main></body></html>
`;
const out = [
  ["", "en", "terms", EN.terms.title, EN.terms.html],
  ["", "en", "privacy", "Privacy Policy", `<p><i>${EN.privacy.title}</i></p>` + EN.privacy.html],
  ["jp/", "ja", "terms", JA.terms.title, JA.terms.html],
  ["jp/", "ja", "privacy", JA.privacy.title, JA.privacy.html + (JA.ext ? `<h4>${JA.ext.title}</h4>` + JA.ext.html : "")],
];
for (const [dir, lang, doc, title, body] of out) {
  const links = lang === "ja"
    ? `<a href="/jp/terms/">利用規約</a><a href="/jp/privacy/">プライバシーポリシー</a><a href="/terms/">English</a><a href="/jp/">KREELZ JAPANへ戻る</a>`
    : `<a href="/terms/">Terms of Service</a><a href="/privacy/">Privacy Policy</a><a href="/jp/${doc}/">日本語</a><a href="/">Back to KREELZ</a>`;
  fs.mkdirSync(`${dir}${doc}`, { recursive: true });
  fs.writeFileSync(`${dir}${doc}/index.html`, page(lang, doc, title, body, links));
}
console.log("legal pages: /terms/ /privacy/ /jp/terms/ /jp/privacy/ — version", I.version);
