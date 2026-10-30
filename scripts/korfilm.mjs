// Film tab, both editions = Korean films only (per David 2026-10-30): foreign films' Korean trailers (Hollywood, Japanese
// anime…) posted by Korean distributors are taken off the site — whole channels that release only foreign films, and
// titles of known foreign films/franchises from the distributors that release both. usage: node scripts/korfilm.mjs index.html [--dry]
import fs from "fs";
import zlib from "zlib";

export const FOREIGN_CH = new Set(["Warner Bros. Korea", "소니픽쳐스코리아", "MarvelKorea", "판씨네마", "엔케이컨텐츠", "마노엔터테인먼트",
  "MEGABOX메가박스", "Tooniverse-투니버스", "TIFF", "무비락", "유니버설 픽쳐스 코리아",
  "월트디즈니컴퍼니코리아", "20세기 스튜디오 코리아", "파라마운트 픽쳐스 코리아", "Paramount Pictures Korea", "Universal Pictures Korea"]);
export const FOREIGN_T = /\[듄|듄: ?파트|듄 ?파트|스파이더맨|어벤져스|마블|배트맨|슈퍼맨|해리 ?포터|트랜스포머|미션 ?임파서블|분노의 ?질주|쥬라기|아바타|디즈니 ?(애니메이션|픽사)|픽사|드림웍스|미니언즈|슈렉|겨울왕국|토이 ?스토리|주토피아|극장판:? ?(치이카와|짱구|크레용|코난|도라에몽|포켓몬|원피스|귀멸|주술|하이큐|나루토|드래곤볼|체인소|스파이 ?패밀리|진격)|치이카와|원피스|귀멸의 ?칼날|명탐정 ?코난|도라에몽|포켓몬|지브리|미야자키|신카이|조니 ?뎁|톰 ?크루즈|브래드 ?피트|키아누|니콜라스 ?케이지|스트리트 ?파이터|백룸|데드포인트|스크루지|하트 ?오브 ?비스트|에이리언|프레데터|고질라|킹콩|007|제임스 ?본드|위키드|나니아|모자 ?쓴 ?고양이|숀 ?더 ?쉽|룩백|할리우드|외화|일본 ?애니|1917|오리지널 ?티켓/i;
export const foreignFilm = (title, channel) => FOREIGN_CH.has(String(channel || "").trim()) || FOREIGN_T.test(String(title || ""));

if (process.argv[1] && process.argv[1].endsWith("korfilm.mjs")) {
  const site = process.argv[2] || "index.html", dry = process.argv.includes("--dry");
  let h = fs.readFileSync(site, "utf8");
  const vm = JSON.parse(zlib.gunzipSync(fs.readFileSync("data/vmeta.json.gz")));
  let n = 0; const ex = [];
  for (const name of ["FEED", "SHORTS"]) {
    const m = h.match(new RegExp(`const ${name} = "([^"]*)";`)), s = m[1]; let out = "";
    for (let i = 0; i + 16 <= s.length; i += 16) {
      const row = s.slice(i, i + 16), v = vm[row.slice(0, 11)];
      if (row[11].toLowerCase() === "f" && v && foreignFilm(v[0], v[2])) { n++; if (ex.length < 40) ex.push(`${v[2]} :: ${v[0].slice(0, 60)}`); continue; }
      out += row;
    }
    h = h.replace(m[0], () => `const ${name} = "${out}";`);
  }
  console.log("foreign films removed:", n); if (dry) console.log(ex.join("\n"));
  if (!dry) fs.writeFileSync(site, h);
}
