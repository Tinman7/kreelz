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
export const FANCAM_M = /직캠|fancam|fan ?cam|세로캠|페이스캠|face ?cam|focus ?cam|\bfocus\b|콘서트|concert|\bcam\b/i;
// extra channel ids found later (e.g. KATSEYE's) can be added in scripts/artist_channels.json {"KATSEYE": ["UC..."]}
import fs from "node:fs";
try { const extra = JSON.parse(fs.readFileSync(new URL("./artist_channels.json", import.meta.url), "utf8"));
      for (const a of ARTISTS) if (extra[a[0]]) a[1].push(...extra[a[0]]); } catch (e) {}
// rank: 1 (first) .. ARTISTS.length, 0 = not a priority artist
export function rank(meta) {
  if (!meta) return 0;
  const text = meta[0] + " " + (meta[5] || []).join(" ");
  for (let i = 0; i < ARTISTS.length; i++) if (ARTISTS[i][1].includes(meta[1]) || ARTISTS[i][2].test(text)) return i + 1;
  return 0;
}
