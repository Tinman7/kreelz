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
// Japan edition: actors Japanese K-drama fans follow most (2026 Japanese rankings: Kim Seon-ho, Byeon Woo-seok, Lee Jun-ho,
// Nam Joo-hyuk, Woo Do-hwan ... plus the global list)
export const JP_ACTORS = [
  ["Kim Seon-ho", "김선호", /김선호|kim ?seon[- ]?ho|キム・ソンホ/i],
  ["Byeon Woo-seok", "변우석", /변우석|byeon ?woo[- ]?seok|byun ?woo[- ]?seok|ビョン・ウソク/i],
  ["Lee Jun-ho", "이준호", /이준호|lee ?jun[- ]?ho|イ・ジュノ|2pm ?준호/i],
  ["Cha Eun-woo", "차은우", /차은우|cha ?eun[- ]?woo|チャ・ウヌ/i],
  ["Nam Joo-hyuk", "남주혁", /남주혁|nam ?joo[- ]?hyuk|ナム・ジュヒョク/i],
  ["Ahn Hyo-seop", "안효섭", /안효섭|ahn ?hyo[- ]?seop|アン・ヒョソプ/i],
  ["Song Kang", "송강", /송강(?!호)|song ?kang(?![- ]?ho)|ソン・ガン/i],
  ["Woo Do-hwan", "우도환", /우도환|woo ?do[- ]?hwan|ウ・ドファン/i],
  ["Park Bo-gum", "박보검", /박보검|park ?bo[- ]?gum|パク・ボゴム/i],
  ["Lee Do-hyun", "이도현", /이도현|lee ?do[- ]?hyun|イ・ドヒョン/i],
  ["Hwang In-youp", "황인엽", /황인엽|hwang ?in[- ]?y(ou|eo)p|ファン・イニョプ/i],
  ["Choo Young-woo", "추영우", /추영우|choo ?young[- ]?woo|チュ・ヨンウ/i],
  ["Lomon", "로몬", /로몬|\blomon\b|ロモン/i],
  ["Lee Jong-suk", "이종석", /이종석|lee ?jong[- ]?suk|イ・ジョンソク/i],
  ["Rowoon", "로운", /(?<![가-힣])로운(?![가-힣])|\browoon\b|ロウン/i],
];
export function actorScoreIn(list, meta) {
  if (!meta) return 0;
  const text = meta[0] + " " + (meta[5] || []).join(" ");
  if (!list.some(a => a[2].test(text))) return 0;
  return FANCAM.test(text) ? 3 : ROMANCE.test(text) ? 2 : 1;
}
export const ROMANCE = /로맨스|로코|멜로|키스|설렘|심쿵|고백|연애|커플|첫사랑|사랑|데이트|직진|썸|남친|여친|결혼|프러포즈|romance|romantic|rom-?com|love|kiss|couple|crush|confess|date\b|dating|boyfriend|girlfriend|wedding|proposal/i;
// fancams and fan-event clips of the actors (fan meetings, events, airport, red carpet, concerts)
export const FANCAM = /직캠|fancam|fan ?cam|팬미팅|fan ?meet|팬사인|팬싸|fansign|무대인사|공항|출국|입국|airport|레드카펫|red ?carpet|포토월|포토콜|photocall|photo ?wall|시상식|award|콘서트|concert|이벤트|event|촬영장|팝업|pop-?up|\bcam\b|focus/i;
// 3 = fancam of a focus actor, 2 = popular actor in a romance, 1 = popular actor, 0 = other
export function actorScore(meta) {
  if (!meta) return 0;
  const text = meta[0] + " " + (meta[5] || []).join(" ");
  if (!ACTORS.some(a => a[2].test(text))) return 0;
  return FANCAM.test(text) ? 3 : ROMANCE.test(text) ? 2 : 1;
}
