// Fan edits (per David 2026-11-25: "공식 계정이 아니라 팬들이나 기타 유튜버들이 만든 조회수 많고 재밌게 편집해 놓은 쇼츠 … 전체에서 10~20%"):
//   node scripts/fanedit.mjs index.html — every short on the site of the HYBE / priority artists that is NOT from an official
//   artist channel or a broadcaster / label / media channel, and is a fun edit (funny / cute moments, edits, 웃긴 · 귀여운,
//   面白い · 可愛い …) rather than news, rumours, reactions, fancams or covers → const PRIO_FANEDIT (ids).
//   The app (editMix) gives them one place in every 6 (about 17%) of the shorts in All and Music.
// New ones come in every night through the konbini group "hybe_fanedit" (shorts, 100k+ views, last 30 days).
import fs from "node:fs";
import zlib from "node:zlib";
import { ARTISTS } from "./hybe.mjs";

const WHO = ["BTS", "CORTIS", "LE SSERAFIM", "ILLIT", "TXT", "SEVENTEEN", "ENHYPEN", "BOYNEXTDOOR", "TWS", "KATSEYE"];
const A = ARTISTS.filter(a => WHO.includes(a[0])), OFFICIAL = new Set(A.flatMap(a => a[1]));
// broadcasters, labels, platforms and media: not fan-made
export const MEDIA = /kbs|mbc|sbs|mnet|\bm2\b|jtbc|tvn|stone music|1thek|dingo|hybe|bangtan|weverse|all the k-?pop|studio choom|it'?s live|billboard|genie|melon|arirang|ebs|channel a|tving|netflix|spotify|apple music|vogue|elle|\bgq\b|w korea|harper|allure|cosmopolitan|esquire|marie|dazed|vlive|osen|news|ytn|yonhap|ilgan|dispatch|starnews|sports|mbn|tv ?chosun|tv조선|k-?pop on|jyp|sm ?town|\byg\b|universal|official|entertainment|music core|inkigayo|show!? ?champion|the show|music bank|pledis|belift|koz|source music|\bador\b|big ?hit|oricon|lemino|abema|mama/i;
export const FUN = /funny|funniest|moments?\b|cute|\bedits?\b|#edit|kpopedit|chaos|crack|meme|\blol\b|ㅋㅋ|웃긴|웃김|웃음|귀여|귀엽|레전드|모먼트|케미|티키타카|댕청|허당|애교|aegyo|사랑스|面白|おもしろ|可愛|かわい|爆笑|ハプニング|天然|尊い|まとめ|ほっこり/i;
export const NOT_FUN = /이유|논란|사건|무슨 ?일|발열|중단|탈퇴|열애|해체|소송|충격|衝撃|理由|炎上|決定|news|뉴스|근황|해명|사과|불화|왕따|저격|비난|악플|reaction|리액션|반응|kdrama|드라마|ranking|순위|\bvs\b|fancam|직캠|cover|커버|tutorial|mirror|kiss|jealous|rizz|subscribe|구독|trending|\bai\b|lyrics?|가사/i;
/** a fun fan edit of the artists? (title, channel id, channel name, tags) */
export const isFanEdit = (title, chId, chName, tags) => {
  const t = String(title || ""), all = `${t} ${Array.isArray(tags) ? tags.join(" ") : tags || ""}`;
  const cn = String(chName || "").trim().toLowerCase();
  return !OFFICIAL.has(chId) && !MEDIA.test(cn) && !WHO.some(n => n.toLowerCase() === cn) && A.some(a => a[2].test(t)) && FUN.test(all) && !NOT_FUN.test(t);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const site = process.argv[2] || "index.html"; let h = fs.readFileSync(site, "utf8");
  if (!/const PRIO_FANEDIT = "[^"]*";/.test(h)) { console.log("fanedit: no PRIO_FANEDIT in", site); process.exit(0); }
  let vm = {}; try { vm = JSON.parse(zlib.gunzipSync(fs.readFileSync("data/vmeta.json.gz"))); } catch (e) {}
  const s = (/const SHORTS = "([^"]*)"/.exec(h) || [])[1] || "", ids = [];
  for (let i = 0; i + 16 <= s.length; i += 16) { const id = s.slice(i, i + 11), m = vm[id];
    if (m && isFanEdit(m[0], m[1], m[2], m[5])) ids.push(id); }
  h = h.replace(/const PRIO_FANEDIT = "[^"]*";/, () => `const PRIO_FANEDIT = "${[...new Set(ids)].join("")}";`);
  fs.writeFileSync(site, h); console.log("fanedit:", ids.length, "fan edits");
}
