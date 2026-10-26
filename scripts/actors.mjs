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
// Japan edition: actors Japanese K-drama fans like best, in ranking order. Source: ねとらぼリサーチ「一番好きな韓国の男性俳優」
// (1,331 votes, 2026-07-17 ~ 08-27 interim; the 2025-26 yearly vote has the same top four). After the ranked names, the
// actors this list had before (other 2026 Japanese rankings). Optional 4th field: text that means it is someone/something else.
export const JP_ACTORS = [
  ["Park Seo-joon", "박서준", /박서준|park ?seo[- ]?joon|パク・?ソジュン/i],
  ["Seo In-guk", "서인국", /서인국|seo ?in[- ]?guk|ソ・?イングク/i],
  ["Kim Jae-joong", "김재중", /김재중|kim ?jae[- ]?joong|jaejoong|ジェジュン/i],
  ["Park Hyung-sik", "박형식", /박형식|park ?hyung[- ]?sik|パク・?ヒョンシク/i],
  ["Lee Jun-ki", "이준기", /이준기|lee ?joon[- ]?gi|lee ?jun[- ]?ki|イ・?ジュンギ/i],
  ["Ji Chang-wook", "지창욱", /지창욱|ji ?chang[- ]?wook|チ・?チャンウク/i],
  ["Park Bo-gum", "박보검", /박보검|park ?bo[- ]?gum|パク・?ボゴム/i],
  ["Byeon Woo-seok", "변우석", /변우석|byeon ?woo[- ]?seok|byun ?woo[- ]?seok|ビョン・?ウソク/i],
  // 지성 is also the Korean word for oily skin: only "배우 지성", #지성, 지성x(co-star) or the English/Japanese name
  ["Ji Sung", "지성", /배우 ?지성|#지성(?![가-힣])|(?<![가-힣])지성 ?[x×](?=[가-힣])|(?<=[가-힣])[x×] ?지성(?![가-힣])|\bji sung\b|チ・?ソン(?![ァ-ヶー])/i, /nct|엔시티|park ji ?sung|박지성/i],
  ["Gong Yoo", "공유", /gong ?yoo|コン・?ユ(?![ァ-ヶー])|배우 ?공유|#공유(?![가-힣])/i],
  ["Kim Nam-gil", "김남길", /김남길|kim ?nam[- ]?gil|キム・?ナムギル/i],
  ["Lee Jun-ho", "이준호", /이준호|lee ?jun[- ]?ho|イ・?ジュノ|2pm ?(준호|junho)|ジュノ/i],
  ["Rowoon", "로운", /(?<![가-힣])로운(?![가-힣])|\browoon\b|ロウン/i],
  ["Kim Soo-hyun", "김수현", /김수현|kim ?soo[- ]?hyun|キム・?スヒョン/i],
  ["Heo Nam-jun", "허남준", /허남준|heo ?nam[- ]?jun|ホ・?ナムジュン/i],
  ["Hyun Bin", "현빈", /현빈|hyun ?bin|ヒョンビン/i],
  ["Cha Eun-woo", "차은우", /차은우|cha ?eun[- ]?woo|チャ・?ウヌ/i],
  ["Ahn Hyo-seop", "안효섭", /안효섭|ahn ?hyo[- ]?seop|アン・?ヒョソプ/i],
  ["Jung Hae-in", "정해인", /정해인|jung ?hae[- ]?in|チョン・?ヘイン/i],
  ["Song Kang", "송강", /송강(?!호)|song ?kang(?![- ]?ho)|ソン・?ガン(?!ホ)/i],
  ["Lee Byung-hun", "이병헌", /이병헌|lee ?byung[- ]?hun|イ・?ビョンホン/i],
  ["Lee Min-ho", "이민호", /이민호|lee ?min[- ]?ho|イ・?ミンホ/i, /투수|야구|baseball|lg ?트윈스|twins/i],
  // before the ranking
  ["Kim Seon-ho", "김선호", /김선호|kim ?seon[- ]?ho|キム・?ソンホ/i],
  ["Nam Joo-hyuk", "남주혁", /남주혁|nam ?joo[- ]?hyuk|ナム・?ジュヒョク/i],
  ["Woo Do-hwan", "우도환", /우도환|woo ?do[- ]?hwan|ウ・?ドファン/i],
  ["Lee Do-hyun", "이도현", /이도현|lee ?do[- ]?hyun|イ・?ドヒョン/i],
  ["Hwang In-youp", "황인엽", /황인엽|hwang ?in[- ]?y(ou|eo)p|ファン・?イニョプ/i],
  ["Choo Young-woo", "추영우", /추영우|choo ?young[- ]?woo|チュ・?ヨンウ/i],
  ["Lomon", "로몬", /로몬|\blomon\b|ロモン/i],
  ["Lee Jong-suk", "이종석", /이종석|lee ?jong[- ]?suk|イ・?ジョンソク/i],
];
// Japanese names for the Japan-edition searches (scripts/japan.mjs), in the same order
export const JP_ACTOR_JA = { "Park Seo-joon": "パク・ソジュン", "Seo In-guk": "ソ・イングク", "Kim Jae-joong": "ジェジュン",
  "Park Hyung-sik": "パク・ヒョンシク", "Lee Jun-ki": "イ・ジュンギ", "Ji Chang-wook": "チ・チャンウク", "Park Bo-gum": "パク・ボゴム",
  "Byeon Woo-seok": "ビョン・ウソク", "Ji Sung": "チソン 俳優", "Gong Yoo": "コン・ユ", "Kim Nam-gil": "キム・ナムギル", "Lee Jun-ho": "イ・ジュノ",
  "Rowoon": "ロウン", "Kim Soo-hyun": "キム・スヒョン", "Heo Nam-jun": "ホ・ナムジュン", "Hyun Bin": "ヒョンビン", "Cha Eun-woo": "チャ・ウヌ",
  "Ahn Hyo-seop": "アン・ヒョソプ", "Jung Hae-in": "チョン・ヘイン", "Song Kang": "ソン・ガン", "Lee Byung-hun": "イ・ビョンホン", "Lee Min-ho": "イ・ミンホ" };
const hit = (a, text) => a[2].test(text) && !(a[3] && a[3].test(text));
// What kind of video of a Japan-edition actor it is. /jp mixes them: romance most, then fan meetings, events and fancams,
// fan-made videos, then the rest. Checked in this order, so a fancam from a fan meeting counts as a fan meeting.
export const JP_FANMEET = /팬미팅|팬 ?미팅|fan ?meet|팬사인|팬싸|fan ?sign|무대인사|팬콘|fan ?con(cert)?\b|ファンミ|ファンミーティング|ファンサイン|ファンコン|舞台挨拶|ハイタッチ|お見送り/i;
export const JP_EVENT = /직캠|fancam|fan ?cam|공항|출국|입국|airport|레드카펫|red ?carpet|포토월|포토콜|photocall|photo ?wall|시상식|awards?\b|제작발표회|기자간담회|쇼케이스|showcase|이벤트|\bevent|팝업|pop-?up|촬영장|直撮り|直カメ|ファンカム|来日|空港|レッドカーペット|授賞式|アワード|イベント|記者会見|制作発表|ショーケース/i;
export const JP_FANMADE = /\bf ?m ?v\b|fan ?made|fan ?edit|fanmade|팬메이드|팬 ?영상|교차 ?편집|\bedits?\b|#\w*edit\b|ファンメイド|手描き|\btribute\b/i;
// 1-based place of the first JP_ACTORS name in the video (0 = none)
export function jpActorRank(meta) {
  if (!meta) return 0;
  const text = meta[0] + " " + (meta[5] || []).join(" ");
  return JP_ACTORS.findIndex(a => hit(a, text)) + 1;
}
export function jpActorKind(meta) {
  if (!meta) return "";
  const text = meta[0] + " " + (meta[5] || []).join(" ");
  if (!JP_ACTORS.some(a => hit(a, text))) return "";
  return JP_FANMEET.test(text) ? "f" : JP_EVENT.test(text) ? "e" : (JP_FANMADE.test(text) || /\bMAD\b/.test(text)) ? "m"
    : (ROMANCE.test(text) || JP_ROMANCE.test(text)) ? "r" : "o";
}
export const JP_ROMANCE = /キスシーン|キス|胸キュン|ラブコメ|恋愛|ロマンス|告白|プロポーズ|デート|カップル|溺愛|片思い|初恋/;
export function actorScoreIn(list, meta) {
  if (!meta) return 0;
  const text = meta[0] + " " + (meta[5] || []).join(" ");
  if (!list.some(a => a[2].test(text) && !(a[3] && a[3].test(text)))) return 0;
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
