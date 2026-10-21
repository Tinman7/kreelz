// Screen & Shows focus: young male leads popular in the Philippines / Southeast Asia, romance first.
// Sources: Manila fan meetings 2024-2026 (GMA, Manila Bulletin), Jakpat 2025 Indonesia survey (Databoks), 2026 slates.
export const ACTORS = [
  ["Byeon Woo-seok", "변우석", /변우석|byeon ?woo[- ]?seok|byun ?woo[- ]?seok/i],
  ["Kim Seon-ho", "김선호", /김선호|kim ?seon[- ]?ho/i],
  ["Choo Young-woo", "추영우", /추영우|choo ?young[- ]?woo/i],
  ["Lomon", "로몬", /로몬|\blomon\b/i],
  ["Hwang In-youp", "황인엽", /황인엽|hwang ?in[- ]?y(ou|eo)p/i],
  ["Cha Eun-woo", "차은우", /차은우|cha ?eun[- ]?woo/i],
  ["Song Kang", "송강", /송강(?!호)|song ?kang(?![- ]?ho)/i],
  ["Ahn Hyo-seop", "안효섭", /안효섭|ahn ?hyo[- ]?seop/i],
  ["Park Bo-gum", "박보검", /박보검|park ?bo[- ]?gum/i],
  ["Lee Jong-suk", "이종석", /이종석|lee ?jong[- ]?suk/i],
  ["Lee Do-hyun", "이도현", /이도현|lee ?do[- ]?hyun/i],
  ["Rowoon", "로운", /(?<![가-힣])로운(?![가-힣])|\browoon\b/i],
];
export const ROMANCE = /로맨스|로코|멜로|키스|설렘|심쿵|고백|연애|커플|첫사랑|사랑|데이트|직진|썸|남친|여친|결혼|프러포즈|romance|romantic|rom-?com|love|kiss|couple|crush|confess|date\b|dating|boyfriend|girlfriend|wedding|proposal/i;
// 2 = popular actor in a romance, 1 = popular actor, 0 = other
export function actorScore(meta) {
  if (!meta) return 0;
  const text = meta[0] + " " + (meta[5] || []).join(" ");
  if (!ACTORS.some(a => a[2].test(text))) return 0;
  return ROMANCE.test(text) ? 2 : 1;
}
