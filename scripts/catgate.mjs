// Category gate (per David 2026-11-12: "카테고리별로 다른 카테고리 컨텐츠가 있는지 … 매일 업데이트하는 로직에서 정비").
// The last check of the nightly refresh, both editions: every clip is checked against the tab it sits in.
//   Beauty        only beauty videos. TV shows that landed here (보검매직컬, 몸신의 탄생, 알콩달콩 …) move to Shows / Screen /
//                 Music, anything else without a beauty word in its title or tags leaves the site.
//   K-Travel&Food Korean food and trips in Korea only: the title or tags must name a Korean dish / Korean food word or a
//                 trip in Korea. Off the site: eating shows and eat-a-lot videos (noeat.mjs + more below), food that is
//                 not Korean (burgers, pizza, steak, sushi, 마라탕 … unless a Korean dish is named too), trips abroad,
//                 skits ("~ 유형"), and documentaries / TV clips that are about neither. TV variety clips move to Shows.
//   Shows / Screen  a drama clip in Shows moves to Screen; a variety clip in Screen moves to Shows (jpvariety.mjs decides
//                 what is variety; that script already moves K-pop and actors out of Shows).
// Travel is put forward (per David: "여행 쪽 좀 더 많이 강조"): the trip clips are written as PRIO_TRAVEL and the app gives
// them 2 of every 3 places at the top of the tab (global edition) / puts them first among the "other" videos (/jp).
// Clips David asked for by id (scripts/konbini.json "ids") are never touched.
// usage: node scripts/catgate.mjs index.html [--dry]      other scripts: import { gate } from "./catgate.mjs"
import fs from "node:fs";
import zlib from "node:zlib";
import { isVariety, moveTo } from "./jpvariety.mjs";
import { eatBlocked } from "./noeat.mjs";

const TV_CH = /디글|diggle|tvn|sbs|mbc|kbs|jtbc|\bena\b|ena 이엔에이|netflix|넷플릭스|tving|티빙|채널a|채널아하|채널에이드|mbn|wavve|웨이브|쿠팡|coupang|tv ?chosun|tv조선|mnet|ootb|채널 ?십오야|스튜디오 ?수제|k-star|sll_official|올끌|tv-people/i;

// ---------- Beauty ----------
export const BEAUTY = /메이크업|make ?-?up|화장|스킨 ?케어|skin ?-?care|grwm|겟 ?레디|get ready with|올리브영|올영|olive ?young|쿠션|파운데이션|파데|컨실러|립스틱|립밤|립 ?(틴트|글로스|글로우|추천)|틴트|섀도|shadow|아이라이너|eyeliner|마스카라|mascara|블러셔|blush|하이라이터|쉐딩|선크림|sunscreen|토너|세럼|serum|앰플|에센스|클렌징|cleans|마스크 ?팩|시트 ?마스크|sheet ?mask|모델링 ?팩|피부|모공|여드름|acne|각질|보습|수분 ?크림|크림|로션|향수|perfume|헤어|hair|머리 ?(손질|스타일|묶)|똥머리|염색|\b펌\b|고데기|단발|앞머리|네일|nail|뷰티|beauty|코스메|コスメ|メイク|スキンケア|美容|ヘア|ネイル|オリーブヤング|괄사|gua ?sha|마사지|massage|화장품|cosmetic|퍼스널 ?컬러|쿨톤|웜톤|뮤트|애교살|속눈썹|눈썹|쌩얼|민낯|성형|시술|피부과|보톡스|필러|리프팅|레티놀|콜라겐|다이소 ?(뷰티|화장|추천템)|glow ?up|k-?beauty|skincare|lip|lash|brow|tutorial|튜토리얼|kbeauty/i;

// ---------- K-Travel & Food ----------
export const KFOOD = /한식|한국 ?음식|한국 ?요리|k-?food|한국식|먹을텐데|korean ?(food|bbq|barbecue|fried chicken|street ?food|cuisine|dish|meal|snack|ramen|noodle|convenience)|김치|kimchi|キムチ|비빔|bibimbap|ビビンバ|불고기|bulgogi|プルコギ|삼겹살|samgyeop|サムギョプサル|목살|갈비|galbi|カルビ|떡볶이|tteok|topokki|トッポギ|トッポッキ|김밥|kimbap|gimbap|キンパ|라면|ramyeon|ramyun|ラーメン|ラミョン|라볶이|국밥|クッパ|찌개|jjigae|チゲ|전골|냉면|naengmyeon|冷麺|막국수|칼국수|カルグクス|수제비|만두|mandu|マンドゥ|순대|スンデ|족발|チョッパル|보쌈|ポッサム|곱창|막창|대창|ホルモン|닭갈비|タッカルビ|닭발|닭한마리|タッカンマリ|치킨|chicken|チキン|삼계탕|samgyetang|参鶏湯|サムゲタン|백숙|설렁탕|ソルロンタン|곰탕|해장국|감자탕|カムジャタン|순두부|sundubu|スンドゥブ|된장|고추장|gochujang|쌈밥|쌈장|부침개|파전|빈대떡|전집|チヂミ|호떡|hotteok|ホットク|붕어빵|プンオパン|떡집|떡국|송편|인절미|한과|약과|yakgwa|빙수|bingsu|ピンス|분식|bunsik|반찬|banchan|집밥|백반|한정식|韓定食|횟집|회 ?센터|조개구이|해물|낙지|주꾸미|쭈꾸미|간장게장|게장|カンジャンケジャン|젓갈|나물|잡채|japchae|チャプチェ|갈비찜|수육|육회|ユッケ|한우|韓牛|hanwoo|소주|soju|ソジュ|막걸리|makgeolli|マッコリ|전통주|포장마차|포차|ポチャ|노포|짜장|jjajang|짬뽕|탕수육|돈까스|김치찜|제육|오징어 ?볶음|닭볶음탕|찜닭|アンドンチムタク|아구찜|해장|국수|비빔면|쫄면|우동|어묵|오뎅|odeng|핫도그|corn ?dog|ハットグ|달고나|dalgona|도시락|급식|편의점|convenience ?store|コンビニ|맛집|グルメ|韓国料理|韓国グルメ|韓国ごはん|韓国飯|食べ歩き|屋台|street ?food|길거리 ?음식|먹거리|시장 ?(음식|투어|먹)|광장시장|広蔵市場|망원시장|통인시장|남대문 ?시장|南大門市場|전통 ?시장|수산 ?시장|가락시장|시장|고깃집|고기 ?(집|굽|구이)|구이|대방어|방어회|장어|전복|꽃게|대게|굴 ?(국밥|전|찜|보쌈)|회 ?(한 ?접시|먹)|자갈치|노량진|kbbq|k-bbq|쿠킹 ?클래스|cooking ?class|料理教室|레시피|recipe|レシピ|요리|cooking|셰프|쉐프|chef|흑백요리사|밥상|식당|맛있는|성심당|런던 ?베이글|베이커리|빵지순례|카페 ?(투어|추천|거리)|カフェ巡り|cafe ?hopping|디저트 ?(투어|맛집)|한국 ?과자|korean snacks?/i;
export const TRAVEL = /여행|旅行|ひとり旅|女子旅|旅|travel|\btrip\b|관광|観光|sightseeing|투어|\btour|ツアー|가볼 ?만한|명소|名所|핫플|ホットスポット|당일치기|日帰り|\d박 ?\d일|\d泊\d日|숙소|호텔|hotel|ホテル|한옥|hanok|韓屋|고택|스테이|템플 ?스테이|temple ?stay|궁궐|경복궁|gyeongbok|景福宮|창덕궁|昌徳宮|덕수궁|북촌|bukchon|北村|서촌|인사동|insadong|仁寺洞|익선동|益善洞|명동|myeong-?dong|明洞|홍대|hongdae|弘大|성수동|seongsu|聖水|이태원|itaewon|梨泰院|강남|gangnam|江南|한강|hangang|han river|漢江|남산|namsan|南山|낙산|naksan|동대문|東大門|ddp|잠실|롯데 ?타워|lotte ?world|롯데월드|에버랜드|everland|서울 ?(숲|역|타워|여행|구경|나들이)|seoul|ソウル|제주|jeju|済州|チェジュ|부산|busan|釜山|プサン|해운대|海雲台|광안리|広安里|감천|甘川|경주|gyeongju|慶州|전주|jeonju|全州|강릉|gangneung|江陵|속초|sokcho|束草|여수|yeosu|통영|춘천|春川|남이섬|nami|南怡島|가평|양양|인천|incheon|仁川|수원|suwon|水原|대구|daegu|大邱|대전|안동|andong|安東|하회마을|dmz|판문점|한복 ?(체험|대여|입고)|hanbok|韓服|チマチョゴリ|찜질방|jjimjilbang|チムジルバン|박물관|museum|博物館|미술관|굿즈|グッズ|뮷즈|축제|festival|祭り|벚꽃|cherry ?blossom|桜|단풍|紅葉|불꽃 ?축제|성지 ?순례|聖地巡礼|ロケ地|촬영지|filming ?location|visit ?korea|korea ?(travel|trip|vlog|tour|guide|itinerary)|things to do|in korea|in seoul|한국 ?(여행|관광|방문|살이|생활|문화|에 ?온|에서 ?놀란|와서|처음)|韓国(旅|観光|vlog|生活|暮らし|ひとり|女子)|渡韓|外国人.*韓国|외국인.*한국|한국.*외국인|foreigners?.*korea|first time in korea|국내 ?여행|드라이브 ?코스|둘레길|올레길|해변|바다 ?(뷰|여행)|야경|夜景|night ?view|전망대|케이블카|루지|한달 ?살기|뚜벅이|ktx|지하철 ?(타고|여행)|공항 ?(철도|에서)|올리브영 ?(쇼핑|투어)|쇼핑 ?(리스트|투어)|ショッピング|爆買い|購入品|お土産|기념품|souvenir/i;
// a place name alone is not a trip ("강남에 20년 산 …"): it needs a trip word, or a food / outing word next to the place
const TRIPWORD = /여행|旅行|ひとり旅|女子旅|旅|travel|\btrip\b|관광|観光|sightseeing|투어|\btour|ツアー|가볼 ?만한|명소|名所|핫플|당일치기|日帰り|\d박 ?\d일|\d泊\d日|숙소|호텔|hotel|ホテル|한옥 ?(숙소|스테이|호텔|마을|카페)|hanok|韓屋|고택|템플 ?스테이|temple ?stay|한복 ?(체험|대여|입고)|hanbok|韓服|찜질방|jjimjilbang|チムジルバン|박물관|museum|博物館|미술관|굿즈|グッズ|뮷즈|축제|festival|祭り|벚꽃|cherry ?blossom|桜|단풍|紅葉|성지 ?순례|聖地巡礼|ロケ地|촬영지|filming ?location|visit ?korea|korea ?(travel|trip|vlog|tour|guide|itinerary)|things to do|in korea|in seoul|한국 ?(여행|관광|방문|살이|문화|에 ?온|에서 ?놀란|와서|처음)|韓国(旅|観光|vlog|ひとり|女子)|渡韓|外国人.*韓国|외국인.*(한국|시장|편의점)|한국.*외국인|foreigners?.*korea|first time in korea|국내 ?여행|드라이브 ?코스|둘레길|올레길|야경|夜景|night ?view|전망대|케이블카|한달 ?살기|뚜벅이|쇼핑 ?(리스트|투어)|ショッピング|爆買い|購入品|お土産|기념품|souvenir|시장 ?(구경|투어|나들이|코스)|\d시간 ?코스/i;
const OUTING = /골목|외국인|外国人|foreigner|가야 ?하는|가봐야|vlog|브이로그|코스|구경|나들이|산책|데이트|카페|맛집|핫플|추천|가이드|guide|walk|워킹|散歩|巡り|グルメ|カフェ|시장|market|street/i;
const tripIn = t => !ABROAD.test(t) && (TRIPWORD.test(t) || (TRAVEL.test(t) && OUTING.test(t)));
// eating shows and eat-a-lot videos (on top of noeat.mjs)
const EATLOT = /무한 ?리필|무제한|뷔페|buffet|ビュッフェ|食べ放題|굶고|굶은|몇 ?끼|싹쓸이|폭풍 ?흡입|흡입|먹부림|폭식|과식|배 ?터지|점보|jumbo|\d+ ?(그릇|판|개|줄|봉지|마리|접시|인분|kg|킬로|만원어치|잔) ?(을|를)? ?(먹|클리어|순삭|도전|격파)|먹 ?방|먹빵|먹스나|eating|빨리 ?먹기|히밥|쯔양|리얼 ?사운드|asmr|한입만|많이 ?먹|혼자 ?다 ?먹|다 ?먹어|털기|털어 ?먹|얼마나 ?먹|끝까지 ?먹|챌린지|challenge|爆食|大食い|食べまくり/i;
// food that is not Korean, and trips abroad
const WESTERN = /햄버거|버거|burger|バーガー|피자|pizza|ピザ|스테이크|steak|ステーキ|파스타|pasta|パスタ|스파게티|리조또|리소토|뇨끼|라자냐|스시|초밥|sushi|寿司|오마카세|사시미|돈테키|규카츠|라멘|츠케멘|우니|마라탕|마라샹궈|마라|훠궈|탕후루|양꼬치|딤섬|타코|taco|부리또|브런치|brunch|샌드위치|sandwich|샐러드|salad|커리|카레|curry|쌀국수|팟타이|똠얌|분짜|반미|케밥|바게트|크루아상|티라미수|마카롱|크레페|도넛|donut|스타벅스|starbucks|맥도날드|mcdonald|버거킹|burger ?king|\bkfc\b|롯데리아|맘스터치|서브웨이|subway|도미노|파파존스|피자헛|쉐이크쉑|shake ?shack|인앤아웃|파이브가이즈|five ?guys|아웃백|빕스|이탈리안|프렌치|양식|일식|중식당|태국 ?음식|베트남 ?음식|인도 ?음식|멕시칸|나폴리|토마토 ?소스|치즈케이크|킷캣|kitkat|초콜릿|chocolate|젤리|사탕|아이스크림|ice ?cream|단백질|프로틴|protein|다이어트 ?식단|소시지|너겟|nugget/i;
const ABROAD = /(일본|도쿄|東京|오사카|大阪|후쿠오카|福岡|교토|京都|삿포로|오키나와|대만|타이베이|台北|홍콩|香港|마카오|중국|상하이|베이징|태국|방콕|치앙마이|베트남|다낭|하노이|호치민|나트랑|푸꾸옥|필리핀|세부|보라카이|발리|싱가포르|말레이시아|인도|몽골|미국|뉴욕|la\b|하와이|괌|사이판|캐나다|유럽|파리|런던|영국|프랑스|이탈리아|로마|스페인|바르셀로나|독일|스위스|튀르키예|호주|시드니|뉴질랜드|두바이|이집트|멕시코|브라질|해외) ?(여행|워홀|현지|맛집|출장|한달|살기|먹방|편의점|길거리|야시장|마트|음식점|식당|에서 ?먹|가서|갔다|도착|1일차|\d일차|브이로그|vlog)|해외 ?여행|시드니|in시드니|워홀|도쿄|오사카|후쿠오카|교토|삿포로|오키나와|타이베이|방콕|다낭|하노이|호치민|베를린|파리 ?(맛집|여행|에서)|런던 ?(맛집|여행|에서)|뉴욕|로마 ?(맛집|여행)|하와이|코타키나발루|東京|大阪|福岡|\b(in|to) (japan|tokyo|osaka|taiwan|thailand|bangkok|vietnam|china|europe|usa|new york)\b/i;
// channels that are about nothing else: Korea's tourism offices (always a trip) and restaurant guides (Korean restaurants unless the title says otherwise)
const TRIP_CH = /visit ?korea|韓国観光公社|korea tourism|visit ?seoul|visit ?busan|visit ?jeju|imagine your korea/i;
const FOOD_CH = /비밀이야|bimirya|성시경|choiza ?road|최자로드|옥스푼|맛집남자|더들리|또간집|먹을텐데|맛있는 ?녀석들|백종원|paik|줄서는 ?식당|전현무계획/i;
// food creators put forward in K-Travel & Food (per David 2026-11-13: 비밀이야, 더들리 — their visits to Korean restaurants only)
export const PRI_CH = [["d", /^더들리$/], ["b", /비밀이야|bimirya/i]];
const priKey = c => (PRI_CH.find(([, rx]) => rx.test(String(c || "").trim())) || [])[0] || "";
const SKIT = /유형|상황극|몰카|빌런|썰 ?(푼|풀)|콩트|꽁트|공감 ?(100|영상)|ㅋㅋㅋ.*유형|vs ?요즘/;
const OFFK = /병원|후원금|드론|아나운서|귀농|귀촌|무인도|양식장|투망|조업|수양|동창|동기들|농사|공장|진돗개|강아지|반려견|고양이|훈련사|동물원|건축|집 ?짓|구옥|인테리어|아파트|전기세|곰팡이|리모델링|정년|퇴직|은퇴|전쟁|6·25|스님|산삼|어부|낚시|대물|타일|탈모|주식|부동산|재테크|피규어|포켓몬|게임|당뇨|혈당|당화혈|혈압|관절|지압|소화불량|건강 ?(비결|법|정보)|다이어트 ?비결|자연인/;

const low = s => String(s || "").toLowerCase();
/** the tab a clip belongs in — the same letter (stays), another letter (moves) or "" (leaves the site)
 *  cat: m d f e b k · title, channel: as YouTube shows them · tags: array or string */
export function gate(cat, title, channel, tags) {
  cat = low(cat); const t = String(title || ""), c = String(channel || ""), g = Array.isArray(tags) ? tags.join(" ") : String(tags || ""), tv = TV_CH.test(c);
  const tvMove = () => isVariety(t, c, "e") ? "e" : (moveTo(t, c) || "");
  if (cat === "b") {
    if (tv && (isVariety(t, c, "e") || !/메이크업|make ?-?up|화장|스킨 ?케어|skin ?-?care|뷰티|beauty|grwm|겟 ?레디|올리브영|헤어 ?스타일|네일/i.test(t))) return tvMove();   // a TV clip is a beauty video only when its title says so
    if (!BEAUTY.test(t) && !BEAUTY.test(g)) return "";
    return "b";
  }
  if (cat === "k") {
    if (eatBlocked(t, c, "k")) return "";
    if (TRIP_CH.test(c)) return "k";
    if (tv && isVariety(t, c, "e")) return "e";
    const food = KFOOD.test(t) || (FOOD_CH.test(c) && !WESTERN.test(t)), trip = tripIn(t), doc = /ebs|다큐|documentary/i.test(c);
    if (OFFK.test(t) && (doc || !food)) return "";      // houses, animals, health, war … whatever place they name
    if (doc && !food && !TRIPWORD.test(t)) return "";
    if (tv) return (food || trip) && !OFFK.test(t) && !WESTERN.test(t) && !ABROAD.test(t) ? "k" : "";
    if (ABROAD.test(t)) return "";
    if (SKIT.test(t)) return "";
    if (EATLOT.test(t) && !trip) return "";
    if (WESTERN.test(t) && !food && !trip) return "";
    if (WESTERN.test(t) && !/김치|한식|떡볶이|불고기|비빔|갈비|삼겹|korean|한국|韓国/i.test(t) && !trip) return "";
    if (food || trip) return "k";
    if ((KFOOD.test(g) || TRAVEL.test(g)) && !WESTERN.test(t) && !OFFK.test(t) && !/ebs/i.test(c)) return "k";   // hashtag-only shorts of food and trip channels
    return "";
  }
  if (cat === "e") { if (!isVariety(t, c, "e") && /드라마|ドラマ|k-?drama|\bdrama\b|웹드|숏드|미니시리즈|일일극|주말극/i.test(t)) return "d"; return "e"; }
  if (cat === "d") { if (tv && isVariety(t, c, "e") && !/drama|드라마/i.test(c)) return "e"; return "d"; }
  return cat;
}
/** a trip clip (for PRIO_TRAVEL): a K-Travel & Food clip whose title is about a trip in Korea, not a restaurant or a recipe */
export const isTrip = (title, channel) => { const t = String(title || ""); return TRIP_CH.test(String(channel || "")) || tripIn(t); };

if (import.meta.url === `file://${process.argv[1]}`) {
  const site = process.argv[2] || "index.html", dry = process.argv.includes("--dry");
  let h = fs.readFileSync(site, "utf8");
  let vm = {}; try { vm = JSON.parse(zlib.gunzipSync(fs.readFileSync("data/vmeta.json.gz"))); } catch (e) {}
  const B = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_", S = {};
  const sh = id => ((B.indexOf(id[0]) * 64 + B.indexOf(id[1])) % 256).toString(16).padStart(2, "0");
  const T = id => { const m = vm[id]; if (m) return [m[0], m[2], m[5] || []];
    const k = sh(id); if (!(k in S)) { try { S[k] = JSON.parse(fs.readFileSync(`t/o/${k}.json`, "utf8")); } catch (e) { S[k] = {}; } }
    const o = S[k][id]; return o ? [o[0], o[1], []] : null; };
  let keepIds = new Set(); try { for (const g of JSON.parse(fs.readFileSync("scripts/konbini.json", "utf8")).groups || []) for (const id of g.ids || []) keepIds.add(id); } catch (e) {}
  const moves = {}, ex = {}, trips = [], pri = [];
  const stay = (k, e) => { if (dry) (ex[k] = ex[k] || []).push(`${e[1].slice(0, 18)} :: ${e[0].slice(0, 70)}`); };
  for (const name of ["FEED", "SHORTS"]) {
    const m0 = h.match(new RegExp(`const ${name} = "([^"]*)";`)); if (!m0) continue; const s = m0[1]; let out = "";
    for (let i = 0; i + 16 <= s.length; i += 16) {
      const row = s.slice(i, i + 16), id = row.slice(0, 11), c0 = row[11], cat = c0.toLowerCase(), e = T(id);
      if (!e || keepIds.has(id) || !"bked".includes(cat)) { if (e && cat === "k" && isTrip(e[0], e[1])) trips.push(id); out += row; continue; }
      const to = gate(cat, e[0], e[1], e[2]);
      if (to !== cat) { const k = cat + ">" + (to || "x"); moves[k] = (moves[k] || 0) + 1; (ex[k] = ex[k] || []).push(`${e[1].slice(0, 18)} :: ${e[0].slice(0, 70)}`); }
      if (!to) continue;
      if (to === cat) stay(cat + "=" + (cat === "k" && isTrip(e[0], e[1]) ? "trip" : ""), e);
      if (to === "k" && isTrip(e[0], e[1])) trips.push(id);
      if (to === "k" && priKey(e[1])) pri.push(id + priKey(e[1]));
      out += id + (c0 === c0.toUpperCase() ? to.toUpperCase() : to) + row.slice(12);
    }
    h = h.replace(m0[0], () => `const ${name} = "${out}";`);
  }
  const tr = [...new Set(trips)];
  if (/const PRIO_FOODCH = "[^"]*";/.test(h)) h = h.replace(/const PRIO_FOODCH = "[^"]*";/, () => `const PRIO_FOODCH = "${[...new Set(pri)].join("")}";`);
  if (/const PRIO_TRAVEL = "[^"]*";/.test(h)) h = h.replace(/const PRIO_TRAVEL = "[^"]*";/, () => `const PRIO_TRAVEL = "${tr.join("")}";`);
  console.log("catgate:", JSON.stringify(moves), "trips", tr.length, "food creators", new Set(pri).size);
  if (dry) { const n = +(process.argv.find(a => a.startsWith("--n="))?.split("=")[1] || 12), only = process.argv.find(a => a.startsWith("--only="))?.slice(7);
    for (const [k, v] of Object.entries(ex)) { if (only && k !== only) continue; console.log("==", k, v.length); console.log(v.sort(() => Math.random() - 0.5).slice(0, n).join("\n")); } }
  else {
    fs.writeFileSync(site, h);
    // the same check for the daytime clips (live.js: [id, cat, views, day, rankG, rankJ, title, channel, …]); clips David asked for stay
    try { const l = fs.readFileSync("live.js", "utf8"), m = l.match(/^window\.LIVE=(.*?);?\s*$/s);
      if (m) { const L = JSON.parse(m[1]), hold = new Set([...((L.hold || {}).ids || []), ...((L.pin || {}).ids || []), ...keepIds]); let n = 0;
        const fix = x => { if (hold.has(x[0])) return x; const to = gate(x[1], x[6], x[7], ""); if (to === low(x[1])) return x; n++; if (!to) return null; const y = x.slice(); y[1] = to; return y; };
        for (const k of ["v", "s"]) if (Array.isArray(L[k])) L[k] = L[k].map(fix).filter(Boolean);
        if (n) { fs.writeFileSync("live.js", "window.LIVE=" + JSON.stringify(L) + ";\n"); console.log("live.js:", n, "moved or removed"); } }
    } catch (e) { console.log("live.js skipped:", e.message); }
  }
}
