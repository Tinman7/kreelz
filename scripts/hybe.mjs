// HYBE / BTS priority rules (shared by the backfill, the nightly job and scripts/prio.mjs)
export const HYBE_CHANNELS = {
  UCLkAepWjdylmXSltofFvsYQ: "BANGTANTV",
  UC3IZKseVpdzPSBaWxBxundA: "HYBE LABELS",
  UCtiObj3CsEAdNU6ZPWDsddQ: "TOMORROW X TOGETHER OFFICIAL",
  UCArLZtok93cO5R9RI4_Y5Jw: "ENHYPEN",
  UCfkXDY7vwkcJ8ddFGz8KusA: "SEVENTEEN",
  "UCs-QBT4qkj_YiQw1ZntDO3g": "LE SSERAFIM",
  UCEpFoWeCMCo5z3EvWaz6hQQ: "ILLIT",
  UChhKBlh_wvspTh5n4mL0b5g: "BOYNEXTDOOR",
  UC8C6QOPDVYwmuaSBZksefdg: "TWS",
  UCMki_UkHb4qSc0qyEcOHHJw: "NewJeans",
  "UCHD1jo5RhijLfx5-0Ehe_cg": "&TEAM",
  UCZMYvSPulDSUdx7bdtTFdrg: "CORTIS",
};
export const BTS_CHANNEL = "UCLkAepWjdylmXSltofFvsYQ";
const BTS_RE = /방탄소년단|\bbts\b|bangtan|전정국|정국|jung ?kook|jungkook|agust ?d|j-?hope|제이홉|김태형|taehyung|김석진|김남준|민윤기|정호석|박지민/i;
const HYBE_RE = /hybe|하이브|big ?hit|빅히트|방탄소년단|\bbts\b|bangtan|투모로우바이투게더|tomorrow ?x ?together|\btxt\b|엔하이픈|enhypen|세븐틴|seventeen|르세라핌|le ?sserafim|아일릿|illit|보이넥스트도어|boynextdoor|투어스|\btws\b|뉴진스|newjeans|앤팀|&team|캣츠아이|katseye|코르티스|cortis/i;
// 2 = BTS, 1 = HYBE, 0 = other
export function prio(meta) {
  if (!meta) return 0;
  const text = meta[0] + " " + (meta[5] || []).join(" ");
  if (meta[1] === BTS_CHANNEL || BTS_RE.test(text)) return 2;
  if (HYBE_CHANNELS[meta[1]] || HYBE_RE.test(text) || /hybe|big ?hit|belift|pledis|source ?music|\bador\b|\bkoz\b/i.test(meta[2] || "")) return 1;
  return 0;
}
