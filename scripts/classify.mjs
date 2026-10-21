// KREELZ category classifier — decides the category of one video from free YouTube signals.
// Categories: m music · d drama · f film (d+f = "Screen") · e shows/variety · b beauty · k K-Food · null = off-topic (not shown)
// Signals: the title and tags (keywords), YouTube's own video category (categoryId) and topic tags (topicDetails),
// and the channel's usual category (a prior worked out from the channel's other videos).

const R = (s) => new RegExp(s, "i");
const KW = {
  m: [
    [R("뮤직비디오|music ?video|\\bm/?v\\b|official (audio|video|mv)|lyric video|visuali[sz]er|special clip|performance video"), 4],
    [R("인기가요|뮤직뱅크|music ?bank|음악중심|show!? ?music ?core|엠카운트다운|m ?countdown|쇼챔피언|show ?champion|더쇼|the ?show|불후의 ?명곡|복면가왕|히든싱어|스케치북|킬링보이스|killing ?voice|리무진서비스|딩고 ?(뮤직|라이브)|it'?s ?live|studio ?choom|릴레이 ?댄스|relay ?dance"), 4],
    [R("직캠|fancam|fan ?cam|face ?cam|페이스캠|안무 ?(연습|영상)|dance ?practice|choreograph|커버 ?댄스|dance ?cover|\\bcover\\b|커버곡|노래방|라이브 ?클립|live ?clip|\\blive\\b.*(stage|무대)|무대|stage|comeback|컴백|데뷔|debut|앨범|album|싱글|single|타이틀곡|title track|음원|\\bost\\b|노래|\\bsong\\b|가사|lyrics|챌린지|challenge|k-?pop|케이팝|아이돌|idol"), 2],
  ],
  d: [
    [R("드라마|k-?drama|\\bdrama\\b|웹드|숏드|미니시리즈|일일극|주말극|월화|수목|금토|\\bep\\.? ?\\d|\\d+ ?(회|화)\\b|\\[\\d+회\\]|최종회|본방|재방|선공개|명장면|키스신|하이라이트|예고|티저|teaser|넷플릭스 ?(시리즈|오리지널)|티빙 ?오리지널|디즈니\\+|쿠팡플레이|웨이브|시즌 ?\\d|season ?\\d"), 2],
    [R("드라마|k-?drama|\\bdrama\\b"), 2],
  ],
  f: [
    [R("영화|\\bmovie\\b|\\bfilm\\b|예고편|trailer|개봉|박스오피스|box ?office|시사회|제작보고회|무대인사|gv\\b|관객|극장|cinema"), 3],
  ],
  e: [
    [R("나 ?혼자 ?산다|나혼산|i live alone|런닝맨|running ?man|1박 ?2일|놀면 ?뭐하니|전지적 ?참견|전참시|어서와 ?한국은|유 ?퀴즈|유퀴즈|아는 ?형님|knowing ?bros|놀라운 ?토요일|amazing ?saturday|신서유기|지구오락실|라디오스타|radio ?star|무한도전|미운 ?우리 ?새끼|미우새|동상이몽|환승연애|솔로지옥|single'?s ?inferno|나는 ?솔로|나솔|개그콘서트|개콘|snl|짠한형|핑계고|살림남|편스토랑|전현무|백종원|피식대학|문명특급|워크맨|와썹맨|가짜사나이|구해줘 ?홈즈|복면|불후|슈퍼맨이 ?돌아왔다|슈돌|금쪽|골때녀|뭉쳐야|강철부대|흑백요리사|culinary ?class ?wars|physical ?100|피지컬|대탈출|여고추리반|삼시세끼|꽃보다|윤식당|서진이네|텐트 ?밖은|무명전설|미스터트롯|미스트롯|현역가왕|불타는 ?트롯|보이스 ?코리아|쇼미더머니|show ?me ?the ?money|스우파|스맨파|street ?(woman|man) ?fighter|프로듀스|i-?land|보이즈 ?플래닛|걸스 ?플래닛|식스센스|놀라운 ?목요일|강심장|판타스틱 ?패밀리|톡파원|어쩌다 ?어른|신인감독|맡겨만 ?주십|회초리|고딩엄빠|퀸덤|킹덤|로드 ?투 ?킹덤|스테이지 ?파이터|이호선|틈만 ?나면|내새끼의 ?연애|연애박사|술래게임|모태솔로|돌싱글즈|하트시그널|러브캐처"), 5],
    [R("예능|버라이어티|variety|리얼리티|reality|토크쇼|talk ?show|웃음|웃긴|레전드|몰카|게스트|\\bmc\\b|티키타카|케미|방송 ?사고|비하인드|behind|vlog|브이로그|reaction|리액션"), 1.5],
  ],
  b: [
    [R("메이크업|make ?up|makeup|화장품|화장법|스킨 ?케어|skin ?care|skincare|grwm|겟레디윗미|get ready with me|올리브영|olive ?young|다이소 ?뷰티|쿠션|파운데이션|foundation|립스틱|립 ?(틴트|추천)|lip ?(tint|stick)|아이섀도|eyeshadow|아이라이너|마스카라|블러셔|선크림|sunscreen|토너|세럼|serum|앰플|클렌징|cleansing|팩\\b|마스크팩|피부 ?(관리|과|고민|타입)|여드름|모공|퍼스널 ?컬러|personal ?color|웜톤|쿨톤|뷰티|beauty|cosmetic|코스메틱|헤어 ?(스타일|컬러|펌)|hair ?(style|tutorial)|단발|네일|nail|향수|perfume|성형|시술|다이어트 ?(브이로그)?|룩북|lookbook|코디|ootd|패션|fashion"), 3],
    [R("기초 ?(화장|케어|루틴)|스킨 ?로션|로션|수분 ?크림|보습|아이 ?크림|나이트 ?크림|세안|이중 ?세안|폼클렌징|홈 ?케어|각질|미백|탄력|주름|안티 ?에이징|anti-?aging|얼굴 ?마사지|페이스 ?마사지|face ?massage|facial ?massage|괄사|gua ?sha|림프 ?(순환|마사지)|lymphatic|붓기|토너 ?패드|toner ?pad|시트 ?마스크|sheet ?mask|수면 ?팩|sleeping ?mask|모델링 ?팩|moisturi[sz]|skin ?routine|glass ?skin|물광|피부 ?(관리|결|톤|장벽|좋아지는|꿀팁)"), 3],
  ],
  k: [
    [R("먹방|mukbang|먹는 ?(소리|방송)|먹어 ?(봤|보|요)|먹었|먹기 ?챌린지|리얼 ?사운드|asmr ?(eating|먹)|eating ?(show|sounds?|asmr)|\\beating\\b|대식가|맛집|맛있|맛탐|food|푸드|요리|레시피|recipe|cooking|cook\\b|\\bchef\\b|셰프|쿡방|라면|ramen|ramyeon|치킨|chicken|떡볶이|tteok|삼겹살|고기|bbq|바베큐|국밥|짜장|짬뽕|피자|pizza|햄버거|burger|초밥|sushi|생선회|모듬회|광어|연어|해산물|seafood|곱창|마라탕|탕후루|디저트|dessert|빵|케이크|cake|편의점|convenience store|분식|김밥|kimbap|kimchi|김치|비빔밥|bibimbap|불닭|buldak|간식|snack|길거리 ?음식|street ?food|시장 ?(먹|음식)|뷔페|buffet|술안주|혼술|혼밥|집밥|도시락|반찬"), 3],
  ],
};
const TOPIC = {
  m: [/music/i, /^Pop_music$/, /Hip_hop/, /Rhythm_and_blues/, /^Jazz$/, /Rock_music/, /Electronic_music/, /^Soul_music$/],
  k: [/^Food$/],
  b: [/Physical_attractiveness/, /^Fashion$/],
  tv: [/Television_program/],
  film: [/^Film$/],
  off: [/Video_game|Action_game|Role-playing_video_game|Strategy_video_game|Sport|football|Basketball|Baseball|Politics|Military|Vehicle|Technology|Pet$|^Religion|Knowledge|Business/i],
};
const OFF_CAT = new Set(["2", "15", "17", "20", "25", "27", "28", "29"]);   // autos, pets, sports, gaming, news, education, science, nonprofit

export function scores(meta) {
  const [title, , chTitle, catId, topics = [], tags = []] = meta;
  const text = (title + " " + tags.join(" ")).replace(/\s+/g, " ");
  const S = { m: 0, d: 0, f: 0, e: 0, b: 0, k: 0, off: 0 };
  for (const c in KW) for (const [re, w] of KW[c]) if (re.test(text)) S[c] += w;
  // YouTube video category
  if (catId === "10") S.m += 3;
  else if (catId === "1") { S.f += 1.5; S.d += 1; }
  else if (catId === "24") { S.e += 0.6; S.d += 0.4; }
  else if (catId === "23") S.e += 1;
  else if (catId === "26") { S.b += 1.5; S.k += 1; }
  else if (catId === "22") { S.b += 0.3; S.k += 0.3; }
  else if (catId === "19") S.k += 0.5;
  else if (OFF_CAT.has(catId)) S.off += 2.5;
  // YouTube topics
  const has = list => topics.some(t => list.some(re => re.test(t)));
  if (has(TOPIC.m)) S.m += 2.5;
  if (has(TOPIC.k)) S.k += 3;
  if (has(TOPIC.b)) S.b += 2.5;
  if (has(TOPIC.tv)) { S.d += 1; S.e += 1; }
  if (has(TOPIC.film)) { S.f += 0.8; S.d += 0.8; }
  if (has(TOPIC.off)) S.off += 1.5;
  if (topics.some(t => /Lifestyle/.test(t))) { S.b += 0.3; S.k += 0.3; }
  return S;
}

// prior: {channelId: category} from the channel's own videos; official: is this from a whitelisted official channel
const HANGUL = /[가-힣]/;
const KWORD = /k-?pop|kpop|k-?drama|kdrama|k-?beauty|k-?food|korean|korea|seoul|한국|케이팝/i;
export const isKorean = (meta, koreanChannels) => !!meta && (HANGUL.test(meta[0] + " " + meta[5].join(" ")) || KWORD.test(meta[0] + " " + meta[5].join(" ")) || (koreanChannels && koreanChannels.has(meta[1])));
export function classify(meta, prior, official, koreanChannels) {
  if (!meta) return null;
  if (koreanChannels && !isKorean(meta, koreanChannels)) return null;   // KREELZ shows Korean content only
  const S = scores(meta);
  const p = prior && prior[meta[1]];
  if (p) S[p] += official ? 3 : 1.5;   // official broadcaster/label channels rarely post off-category videos
  let best = null, bs = 0;
  for (const c of ["m", "d", "f", "e", "b", "k"]) if (S[c] > bs) { bs = S[c]; best = c; }
  if (S.off >= 2.5 && bs < 4) return null;            // games, sports, news... unless clearly K-content
  if (bs < 2 && p && S.off < 2.5) { best = p; bs = 2; } // emoji/hashtag-only shorts: trust the channel's usual category
  if (bs < 2) return null;                            // nothing says what this is
  if ("mdfe".includes(best) && !official) return null; // music/screen/shows only from official channels
  if (best === "d" && S.f > S.d) best = "f";
  return best;
}

// channel prior: majority of a channel's confidently classified videos
export function channelPriors(rows) {   // rows: [meta]
  const by = {};
  for (const m of rows) {
    if (!m) continue;
    const S = scores(m); let best = null, bs = 0;
    for (const c of ["m", "d", "f", "e", "b", "k"]) if (S[c] > bs) { bs = S[c]; best = c; }
    if (bs < 4 || S.off >= 2.5) continue;
    ((by[m[1]] ||= {})[best] = (by[m[1]][best] || 0) + 1);
  }
  const out = {};
  for (const [ch, cnt] of Object.entries(by)) {
    const tot = Object.values(cnt).reduce((a, b) => a + b, 0);
    const [c, n] = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    if (tot >= 5 && n / tot >= 0.6) out[ch] = c;
  }
  return out;
}

// channels whose uploads are mostly Korean (Hangul in title/tags), used to keep English-titled K-pop uploads
export function koreanChannels(rows, extra = []) {
  const n = {}, k = {};
  for (const m of rows) { if (!m) continue; n[m[1]] = (n[m[1]] || 0) + 1; if (HANGUL.test(m[0] + " " + m[5].join(" "))) k[m[1]] = (k[m[1]] || 0) + 1; }
  const out = new Set(extra);
  for (const ch in n) if ((k[ch] || 0) / n[ch] >= 0.3) out.add(ch);
  return out;
}
