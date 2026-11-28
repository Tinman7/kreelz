// SM Entertainment share (per David 2026-11-27: "SM 그룹 무대나 뮤비도 전체 K-팝에서 차지하는 비중은 10에서 15% 정도만"):
// marks the K-pop clips of SM groups (aespa, NCT, RIIZE, EXO, Red Velvet, SHINee, Super Junior, Girls' Generation, Hearts2Hearts,
// TVXQ, WayV, BoA, SMTOWN …) → const PRIO_SM (ids). The app (smCap) keeps them to about 1 place in 8 (12.5%) in All and Music.
// usage: node scripts/smtag.mjs index.html   (nightly, next to fanedit)
import fs from "node:fs";
import zlib from "node:zlib";
import { isGlobal } from "./showsgate.mjs";

export const SM_RX = /aespa|에스파|エスパ|카리나(?![가-힣])|karina|윈터(?=.*(?:에스파|aespa))|닝닝|ningning|\bnct\b|엔시티|nct ?(?:127|dream|wish|u)|wayv|웨이션브이|라이즈|\briize\b|원빈(?=.*(?:라이즈|riize))|\bexo\b|엑소(?![가-힣])|백현(?![가-힣])|레드벨벳|red ?velvet|샤이니|shinee|태민(?![가-힣])|슈퍼주니어|super ?junior|슈주(?![가-힣])|소녀시대|girls'? ?generation|\bsnsd\b|태연(?![가-힣])|하츠투하츠|hearts ?2 ?hearts|하투하|동방신기|\btvxq\b|東方神起|\bboa\b(?=.*(?:kwon|보아|sm))|보아(?![가-힣])|smtown|sm ?entertainment/i;
export const SM_CH = new Set(["UCEf_Bc-KVd7onSeifS3py9g"]);   // SMTOWN

if (import.meta.url === `file://${process.argv[1]}`) {
  const site = process.argv[2] || "index.html"; let h = fs.readFileSync(site, "utf8");
  if (!/const PRIO_SM = "[^"]*";/.test(h)) { console.log("smtag: no PRIO_SM in", site); process.exit(0); }
  let vm = {}; try { vm = JSON.parse(zlib.gunzipSync(fs.readFileSync("data/vmeta.json.gz"))); } catch (e) {}
  const ids = [], local = [];   // local: K-pop clips of acts not known abroad (per David 2026-11-28) — kept off the first 12 shorts
  for (const n of ["FEED", "SHORTS"]) { const s = (new RegExp(`const ${n} = "([^"]*)"`).exec(h) || [])[1] || "";
    for (let i = 0; i + 16 <= s.length; i += 16) { const id = s.slice(i, i + 11), m = vm[id]; if (s[i + 11].toLowerCase() !== "m" || !m) continue;
      const txt = `${m[0]} ${m[2]} ${(m[5] || []).join(" ")}`;
      if (SM_CH.has(m[1]) || SM_RX.test(txt)) ids.push(id); else if (!isGlobal(txt)) local.push(id); } }
  h = h.replace(/const PRIO_SM = "[^"]*";/, () => `const PRIO_SM = "${[...new Set(ids)].join("")}";`)
       .replace(/const PRIO_KLOCAL = "[^"]*";/, () => `const PRIO_KLOCAL = "${[...new Set(local)].join("")}";`);
  fs.writeFileSync(site, h); console.log("smtag:", ids.length, "SM clips in Music,", local.length, "of acts not known abroad");
}
