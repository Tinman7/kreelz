// kreelz.com/jp バラエティ (Shows) tab = Korean variety shows only (per David, 2026-10-30): Running Man, Radio Star,
// 2 Days & 1 Night, talk shows, games, cooking/travel variety and dating reality (나는 SOLO, 환승연애, 솔로지옥…).
// Not dramas, not K-pop, not actor fan clips. Written nightly into the page as PRIO_JPVAR (ids, any category);
// the Japan edition's Shows tab shows only these. usage: node scripts/jpvariety.mjs index.html [--dry]
import fs from "fs";

// show names (Korean / Japanese / English); a title naming one of these is a variety clip
const SHOWS = [
  "런닝맨", "running ?man", "ランニングマン", "라디오 ?스타", "radio ?star", "ラジオスター", "1박 ?2일", "2 days ?(&|and) ?1 night", "1泊2日",
  "나 ?혼자 ?산다", "나혼산", "i live alone", "私は一人で暮らす", "俺は?一人暮らし", "ナ・?ホンジャ", "놀면 ?뭐하니", "hangout with yoo", "무한 ?도전", "infinite challenge", "無限挑戦",
  "아는 ?형님", "knowing ?bros?", "知ってるお兄さん", "유 ?퀴즈", "you ?quiz", "ユ・?クイズ", "놀라운 ?토요일", "놀토", "amazing saturday", "驚きの土曜日",
  "전지적 ?참견 ?시점", "전참시", "미운 ?우리 ?새끼", "미우새", "my little old boy", "신서유기", "新西遊記", "지구 ?오락실", "earth arcade", "地球娯楽室",
  "삼시 ?세끼", "三食ごはん", "서진이네", "jinny'?s kitchen", "ソジンの家", "윤식당", "youn'?s kitchen", "윤스테이", "꽃보다 ?(할배|청춘|누나)", "강식당",
  "맛있는 ?녀석들", "골목식당", "불후의 ?명곡", "immortal songs", "복면가왕", "king of mask singer", "覆面歌王", "히든 ?싱어", "hidden singer",
  "뭉쳐야 ?(찬다|쏜다|뜬다)", "최강 ?야구", "골 ?때리는 ?그녀들", "골때녀", "돌싱포맨", "동상이몽", "미스터 ?트롯", "미스 ?트롯", "불타는 ?트롯맨", "현역 ?가왕", "트롯 ?챔피언",
  "슈퍼맨이 ?돌아왔다", "슈돌", "return of superman", "금쪽같은 ?내 ?새끼", "금쪽 ?상담소", "이호선 ?상담소", "냉장고를 ?부탁해", "편스토랑", "전현무 ?계획", "텐트 ?밖은", "어쩌다 ?사장",
  "언니네 ?산지직송", "정글의 ?법칙", "바퀴 ?달린 ?집", "일로 ?만난 ?사이", "식스 ?센스", "sixth sense", "마니또 ?클럽", "신인 ?감독 ?김연경", "무쇠 ?소녀단", "보검 ?매직컬",
  "강철 ?부대", "steel troops", "스트릿 ?(우먼|맨) ?파이터", "스우파", "street (woman|man) fighter", "ストリートウーマンファイター", "쇼미더머니", "show me the money", "싱어게인", "비긴 ?어게인", "더 ?리슨",
  "크라임 ?씬", "crime scene", "대탈출", "여고 ?추리반", "데블스 ?플랜", "devil'?s plan", "デビルズプラン", "더 ?지니어스", "피의 ?게임", "사이렌:? ?불의 ?섬", "피지컬:? ?100", "physical:? ?100", "フィジカル100",
  "흑백 ?요리사", "culinary class wars", "白と黒のスプーン", "좀비버스", "zombieverse", "코리아 ?넘버원", "핑계고", "짠한형", "살롱 ?드립", "문명 ?특급", "워크맨", "workman", "십오야", "나영석",
  "동네 ?스타K", "가요무대", "전국 ?노래자랑", "개그 ?콘서트", "개콘", "SNL ?코리아", "snl korea", "생활의 ?달인", "세상에 ?이런 ?일이", "순간 ?포착",
  "동치미", "아침마당", "인간 ?극장", "물어보살", "무엇이든 ?물어보살", "푹 ?쉬면 ?다행이야", "안싸우면 ?다행이야", "구해줘!? ?홈즈", "사장님 ?귀는 ?당나귀 ?귀", "당나귀 ?귀", "살림하는 ?남자들",
  "신랑 ?수업", "조선의 ?사랑꾼", "아빠하고 ?나하고", "아빠 ?어디가", "오은영", "결혼 ?지옥", "이혼 ?숙려 ?캠프", "한끼 ?줍쇼", "밥 ?블레스 ?유", "탐정들의 ?영업 ?비밀", "티처스", "신랑 ?수업", "아는 ?형님",
  // OTT originals (per David 2026-10-30): Coupang Play, Netflix, Disney+, TVING, wavve, Prime Video
  "직장인들", "snl ?코리아", "snlコリア", "봉주르 ?빵집", "넥스트 ?레전드", "대학 ?체전", "슈팅 ?스타", "제로썸 ?게임", "저 ?세상 ?패밀리",
  "대환장 ?기안장", "기안장", "대등왜", "유재석 ?캠프", "꿀알바", "dead-?end jobs?", "넷플잔치", "성\\+인물", "먹보와 ?털보", "미스터리 ?수사단", "더 ?인플루언서",
  "피지컬:? ?아시아", "physical ?asia", "singles ?inferno", "culinary ?class ?wars", "better late than single", "devils? ?plan",
  "원수는 ?외야석에서", "랩:? ?퍼블릭", "서울 ?체크인", "마녀 ?사냥", "코미디 ?숏 ?리그", "결혼과 ?이혼 ?사이", "크라임 ?씬 ?(리턴즈|제로)",
  "더 ?커뮤니티", "사상 ?검증 ?구역", "남의 ?연애", "검은 ?양 ?게임", "운명 ?전쟁 ?49", "현무 ?로드", "스타일 ?워즈", "술래 ?게임",
  "더 ?존:? ?버텨야 ?산다", "도깨비 ?10주년", "トッケビ10周年旅行", "神がかりの恋愛", "恋愛リアリティ",
  // dating reality
  "나는 ?solo", "나는 ?솔로", "나솔", "私はSOLO", "환승 ?연애", "乗り換え恋愛", "솔로 ?지옥", "single'?s inferno", "脱出おひとり島", "하트 ?시그널", "heart signal", "ハートシグナル",
  "돌싱글즈", "divorced singles", "연애 ?남매", "모태 ?솔로지만", "모솔 ?연애", "내 ?새끼의 ?연애", "내새끼의연애", "모두의 ?연애", "커플 ?팰리스", "연애의 ?참견", "체인지 ?데이즈", "사랑의 ?콜센타",
  "연애 ?리얼리티", "연프", "데이팅 ?(쇼|프로|리얼리티)", "dating (show|reality)", "恋愛リアリティ", "恋リア", "솔로라서", "연애 ?실험", "끝사랑", "나는 ?솔로 ?그 ?후",
  "예능", "バラエティ", "korean variety", "variety show",
];
export const VAR = new RegExp(SHOWS.join("|"), "i");
// channels that post only variety
const VAR_CH = new Set(["MBCentertainment", "SBS Entertainment", "KBS Entertain", "JTBC Entertainment", "JTBC Voyage", "뜬뜬 DdeunDdeun",
  "채널 십오야", "채널십오야", "라디오스타", "아는형님 Knowingbros", "KBS Entertain: 깔깔티비", "짠한형 신동엽", "피식대학Psick Univ", "TEO 테오", "MMTG 문명특급", "워크맨-Workman", "빠더너스 BDNS", "놀면 뭐하니?",
  "MBC every1", "MBN Entertainment", "tvN STORY 티비엔 스토리", "SBS Running Man", "런닝맨 - 스브스 공식 채널", "1박2일 공식 유튜브",
  "올끌 (All of MBClassic)", "TV-People", "K-STAR 케이스타", "TVCHOSUN JOY"].map(s => s.toLowerCase()));
// not variety even when a show is named: drama scenes and making-of, music stages, fancams, fan meetings, award shows, idol web shows
const NOT = /드라마|ドラマ|韓ドラ|k-?drama|\bdrama\b|메이킹|making|ost\b|직캠|fancam|팬미팅|fan ?meeting|ファンミ|来日|입국|출국|공항|airport|백상|baeksang|aaa\b|asia artist|mama awards?|골든디스크|golden disc|시상식|award|어워즈|어워드|뮤직뱅크|music bank|인기가요|inkigayo|엠카운트다운|m ?countdown|쇼 ?챔피언|show champion|음악중심|music core|더쇼|the show|\bmv\b|m\/v|music video|teaser|티저|official audio|stage|무대|주간 ?아이돌|weekly idol|아이돌 ?룸|idol room|재친구|run bts|달려라 ?방탄|going seventeen|고잉 ?세븐틴|강추 ?리뷰|무대 ?인사|시사회|혈관|혈당|건강 ?(정보|비법|상식)|질환|어서와 ?한국은 ?처음이지|연애 ?박사|이 ?사랑 ?통역 ?되나요|금쪽같은 ?내 ?스타|금스타|살롱 ?드 ?홈즈|\bep\.? ?\d+ ?(예고|선공개)/i;
// drama channels / pages that post scenes (their variety clips still pass with a show name)
const DRAMA_CH = /drama|드라마|ドラマ|tving|티빙|netflix|넷플릭스|disney|디즈니|coupang|쿠팡|wavve|웨이브|스튜디오지니|genie|ena drama|kntv|u-next|hulu|abema|채널에이드/i;

// food-tab clips count only from TV channels (a restaurant creator naming 흑백요리사 is still a food video)
const TV_CH = /디글|tvn|sbs|mbc|kbs|jtbc|ena|netflix|넷플릭스|tving|티빙|채널a|채널에이드|mbn|wavve|웨이브|쿠팡|coupang|tv ?chosun|tv조선|mnet/i;
export function isVariety(title, channel, cat) {
  const t = String(title || ""), c = String(channel || "");
  if (cat === "k" && !TV_CH.test(c)) return false;
  if (/drama|드라마|ドラマ/i.test(c) && !/채널에이드/.test(c)) return false;   // drama channels (KBS Drama, ENA DRAMA…)
  if (/고몽|지무비|김시선|리뷰엉이|무비콕|요약/.test(c)) return false;   // drama and film recap channels
  if (NOT.test(t)) return false;
  if (VAR.test(t)) return true;
  if (VAR_CH.has(c.toLowerCase()) && !DRAMA_CH.test(c)) return true;
  return false;
}

if (process.argv[1] && process.argv[1].endsWith("jpvariety.mjs")) {
  const site = process.argv[2] || "index.html", dry = process.argv.includes("--dry");
  let h = fs.readFileSync(site, "utf8");
  const B = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_", S = {};
  const sh = id => ((B.indexOf(id[0]) * 64 + B.indexOf(id[1])) % 256).toString(16).padStart(2, "0");
  const T = id => { const k = sh(id); if (!(k in S)) { try { S[k] = JSON.parse(fs.readFileSync(`t/o/${k}.json`, "utf8")) } catch { S[k] = {} } } return S[k][id] };
  const ids = [], byCh = {}, ex = [];
  for (const name of ["FEED", "SHORTS"]) {
    const s = h.match(new RegExp(`const ${name} = "([^"]*)";`))[1];
    for (let i = 0; i + 16 <= s.length; i += 16) {
      const id = s.slice(i, i + 11), cat = s[i + 11].toLowerCase(); if (!"edfk".includes(cat)) continue;   // music and beauty never
      const e = T(id); if (!e) continue;
      if (isVariety(e[0], e[1], cat)) { ids.push(id); byCh[e[1]] = (byCh[e[1]] || 0) + 1; if (dry) ex.push(`${cat} ${e[1]} :: ${e[0].slice(0, 80)}`) }
    }
  }
  console.log("variety clips:", ids.length);
  console.log(Object.entries(byCh).sort((a, b) => b[1] - a[1]).slice(0, 45).map(([k, v]) => `${v} ${k}`).join("\n"));
  if (dry) { fs.writeFileSync("/tmp/jpvar_sample.txt", ex.join("\n")); }
  else {
    const line = `const PRIO_JPVAR = "${ids.join("")}"; const JPVAR_RX = ${JSON.stringify([VAR.source, NOT.source])};`;
    if (/const PRIO_JPVAR = "[^"]*"; const JPVAR_RX = .*;\n/.test(h)) h = h.replace(/const PRIO_JPVAR = "[^"]*"; const JPVAR_RX = .*;(?=\n)/, () => line);
    else { const m = h.match(/const FEED_BUILT = "[^"]*";/); h = h.replace(m[0], () => m[0] + "\n" + line); }
    fs.writeFileSync(site, h);
  }
}
