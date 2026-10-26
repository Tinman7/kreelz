// Music priority: artists shown first in the Music tab, in this order (rank 1 = first).
// Each artist is matched by its official channel or by its name in the title/tags.
export const ARTISTS = [
  ["BTS",        ["UCLkAepWjdylmXSltofFvsYQ"], /방탄소년단|\bbts\b|bangtan|전정국|정국|jung ?kook|jungkook|agust ?d|j-?hope|제이홉|김태형|taehyung|김석진|김남준|민윤기|정호석|박지민/i],
  ["CORTIS",     ["UCZMYvSPulDSUdx7bdtTFdrg"], /cortis|코르티스/i],
  ["LE SSERAFIM",["UCs-QBT4qkj_YiQw1ZntDO3g"], /le ?sserafim|르세라핌/i],
  ["ILLIT",      ["UCEpFoWeCMCo5z3EvWaz6hQQ", "UCNVIo0UJXTdEnsRkCB9Q03w"], /illit|아일릿/i],
  ["Stray Kids", ["UC9rMiEjNaCSsebs31MRDCRA"], /stray ?kids|스트레이 ?키즈|스키즈|\bskz\b/i],
  ["TUIDE",      ["UCgQ7HPx1qcmH9_lPTlWOnQw"], /tuide|튜이드/i],
  ["TXT",        ["UCtiObj3CsEAdNU6ZPWDsddQ"], /tomorrow ?x ?together|투모로우바이투게더|투바투|\btxt\b/i],
  ["TWS",        ["UC8C6QOPDVYwmuaSBZksefdg"], /\btws\b|투어스/i],
  ["ENHYPEN",    ["UCArLZtok93cO5R9RI4_Y5Jw"], /enhypen|엔하이픈/i],
  ["ATEEZ",      ["UC2e4Ukj5Pfr7cb3KpJAFBdQ"], /ateez|에이티즈/i],
  ["KATSEYE",    [], /katseye|캣츠아이|캐츠아이/i],
  ["SEVENTEEN",  ["UCfkXDY7vwkcJ8ddFGz8KusA"], /seventeen|세븐틴|\bsvt\b|부석순/i],
];
// Japan edition (kreelz.com/jp): Music order for Japanese fans (per David 2026-10-26): boy groups BTS and Stray Kids
// first, TWICE (Japanese members Sana, Mina, Momo), then TXT, LE SSERAFIM, ILLIT (strong in Japan), then Oricon 2025 annual sales / 2025 Japan tour grosses (Stray Kids, SEVENTEEN, ENHYPEN, &TEAM ...).
// Katakana names match Japanese fan titles (members only where the name is distinctive).
export const JP_ARTISTS = [
  ["BTS",        ["UCLkAepWjdylmXSltofFvsYQ"], /방탄소년단|\bbts\b|bangtan|전정국|정국|jung ?kook|jungkook|agust ?d|j-?hope|제이홉|김태형|taehyung|김석진|김남준|민윤기|정호석|박지민|防弾少年団|バンタン|ジョングク|グク(?![ァ-ヶ])|ジミン|ユンギ|ホソク|ナムジュン|ソクジン/i],
  ["Stray Kids", ["UC9rMiEjNaCSsebs31MRDCRA"], /stray ?kids|스트레이 ?키즈|스키즈|\bskz\b|ストレイキッズ|スキズ/i],
  ["TWICE",      ["UCCRb6nYKaT8tzLA8CwDdUtw"], /\btwice\b|트와이스|トゥワイス|misamo|ミサモ|湊崎紗夏|名井南|平井もも|(?<![ァ-ヶー])(?:サナ|ミナ|モモ|ツウィ|ジヒョ|ナヨン|ダヒョン)(?![ァ-ヶー])/i],
  ["TXT",        ["UCtiObj3CsEAdNU6ZPWDsddQ"], /tomorrow ?x ?together|투모로우바이투게더|투바투|\btxt\b|トゥバ|トゥモロー ?バイ ?トゥギャザー|ヒュニンカイ|ボムギュ|ヨンジュン/i],
  ["LE SSERAFIM",["UCs-QBT4qkj_YiQw1ZntDO3g"], /le ?sserafim|르세라핌|ルセラフィム|ルセラ(?![ァ-ヶ])|ホ・ユンジン|キム・チェウォン|ホン・ウンチェ|カズハ/i],
  ["ILLIT",      ["UCEpFoWeCMCo5z3EvWaz6hQQ", "UCNVIo0UJXTdEnsRkCB9Q03w"], /illit|아일릿|アイリット/i],
  ["SEVENTEEN",  ["UCfkXDY7vwkcJ8ddFGz8KusA"], /seventeen|세븐틴|\bsvt\b|부석순|セブンティーン|セブチ/i],
  ["ENHYPEN",    ["UCArLZtok93cO5R9RI4_Y5Jw"], /enhypen|엔하이픈|エンハイプン/i],
  ["&TEAM",      ["UCHD1jo5RhijLfx5-0Ehe_cg"], /&team|andteam|앤팀|エンティーム/i],
  ["BOYNEXTDOOR",["UChhKBlh_wvspTh5n4mL0b5g"], /boynextdoor|보이넥스트도어|ボイネク/i],
  ["ATEEZ",      ["UC2e4Ukj5Pfr7cb3KpJAFBdQ"], /ateez|에이티즈/i],
  ["TWS",        ["UC8C6QOPDVYwmuaSBZksefdg"], /\btws\b|투어스/i],
  ["aespa",      [], /aespa|에스파/i],
  ["NCT WISH",   ["UCiZqWVAeChfqlom5ZPR3ZJA"], /nct ?wish|엔시티 ?위시/i],
  ["CORTIS",     ["UCZMYvSPulDSUdx7bdtTFdrg"], /cortis|코르티스/i],
];
// The artist a video belongs to: its official channel first, then the title, and the tags only when neither decides
// (uploaders often tag other groups, e.g. an ATEEZ clip tagged "stray kids").
export function rankIn(list, meta) {
  if (!meta) return 0;
  for (let i = 0; i < list.length; i++) if (list[i][1].includes(meta[1])) return i + 1;
  for (let i = 0; i < list.length; i++) if (list[i][2].test(meta[0] || "")) return i + 1;
  const tags = (meta[5] || []).join(" ");
  for (let i = 0; i < list.length; i++) if (list[i][2].test(tags)) return i + 1;
  return 0;
}
// Boy groups among the priority artists, and other popular boy groups whose performance fancams are collected too
export const MALE = new Set(["BTS", "CORTIS", "Stray Kids", "TXT", "TWS", "ENHYPEN", "ATEEZ", "SEVENTEEN"]);
export const EXTRA_MALE = [
  ["NCT DREAM",   [], /nct ?dream|엔시티 ?드림/i],
  ["NCT 127",     [], /nct ?127|엔시티 ?127/i],
  ["RIIZE",       [], /riize|(?<![가-힣])라이즈(?![가-힣])/i],
  ["BOYNEXTDOOR", [], /boynextdoor|보이넥스트도어/i],
  ["ZEROBASEONE", [], /zerobaseone|제로베이스원|\bzb1\b/i],
  ["TREASURE",    [], /\btreasure\b|(?<![가-힣])트레저(?![가-힣])/i],
  ["EXO",         [], /\bexo\b|(?<![가-힣])엑소(?![가-힣])/i],
  ["BIGBANG",     [], /bigbang|빅뱅|g-?dragon|지드래곤/i],
];
// performance fancams (stage, concert, festival, vertical/face cams)
export const FANCAM_M = /직캠|直撮り|ファンカム|fancam|fan ?cam|세로캠|페이스캠|face ?cam|focus ?cam|\bfocus\b|콘서트|concert|\bcam\b/i;
// extra channel ids found later (e.g. KATSEYE's) can be added in scripts/artist_channels.json {"KATSEYE": ["UC..."]}
import fs from "node:fs";
try { const extra = JSON.parse(fs.readFileSync(new URL("./artist_channels.json", import.meta.url), "utf8"));
      for (const a of ARTISTS) if (extra[a[0]]) a[1].push(...extra[a[0]]); } catch (e) {}
// rank: 1 (first) .. ARTISTS.length, 0 = not a priority artist
export function rank(meta) { return rankIn(ARTISTS, meta); }
