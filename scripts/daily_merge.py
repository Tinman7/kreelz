"""Seoul Signal — merge one night's collection into the site.
usage: python3 daily_merge.py <site.html> <daily.json> <YYYY-MM-DD build date, KST> <out.html>
daily.json = {"videos": {id: [cat, views, days, ok]}, "shorts": {id: [cat, views, ok]}}
- existing items keep their place; their age shifts by the days since the last build
- new long videos go to the front with their upload age; new shorts get age 0 (first seen today)
- view counts are refreshed upward when the collector saw a higher number
"""
import json, math, re, sys
from datetime import date
from collections import Counter

B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
enc2 = lambda n: B64[n // 64] + B64[n % 64]
dec2 = lambda s: B64.index(s[0]) * 64 + B64.index(s[1])
vcode = lambda v: 4095 if v is None or v < 0 else min(4094, round(math.log(v + 1) / math.log(1.006)))
vval = lambda c: -1 if c == 4095 else round(1.006 ** c - 1)

def get(h, name):
    m = re.search(r'const %s = "([^"]*)";' % name, h)
    if not m: sys.exit("missing const " + name)
    return m

def decode(s):
    out = []
    for i in range(0, len(s) - 15, 16):
        out.append([s[i:i+11], s[i+11], dec2(s[i+12:i+14]), dec2(s[i+14:i+16])])
    return out

def encode(rows):
    return "".join(r[0] + r[1] + enc2(r[2]) + enc2(r[3]) for r in rows)

def merge(rows, new, delta, kind):
    idx = {r[0]: r for r in rows}
    for r in rows:                                   # age shift
        if r[3] != 4095: r[3] = min(4094, r[3] + delta)
    fresh, upd = [], 0
    for vid, val in new.items():
        if len(vid) != 11: continue
        if kind == "v": c, views, days, ok = val
        else: c, views, ok = val; days = 0
        if c not in "dfmbke": continue
        ch = c.upper() if ok else c
        if vid in idx:
            r = idx[vid]
            if vcode(views) != 4095 and (r[2] == 4095 or vcode(views) > r[2]): r[2] = vcode(views); upd += 1
            continue
        fresh.append([vid, ch, vcode(views), max(0, int(days))])
    fresh.sort(key=lambda r: (r[3], -r[2]))
    return fresh + rows, fresh, upd

def main():
    site, daily, build, outp = sys.argv[1:5]
    h = open(site, encoding="utf-8").read()
    d = json.load(open(daily, encoding="utf-8"))
    old = get(h, "FEED_BUILT").group(1)
    delta = max(0, (date.fromisoformat(build) - date.fromisoformat(old)).days)
    feed, fresh_v, upd_v = merge(decode(get(h, "FEED").group(1)), d.get("videos", {}), delta, "v")
    shorts, fresh_s, upd_s = merge(decode(get(h, "SHORTS").group(1)), d.get("shorts", {}), delta, "s")
    h = h.replace(get(h, "FEED_BUILT").group(0), 'const FEED_BUILT = "%s";' % build, 1)
    h = h.replace(get(h, "FEED").group(0), 'const FEED = "%s";' % encode(feed), 1)
    h = h.replace(get(h, "SHORTS").group(0), 'const SHORTS = "%s";' % encode(shorts), 1)
    open(outp, "w", encoding="utf-8").write(h)
    cat = lambda rows: dict(Counter(r[1].lower() for r in rows))
    print(json.dumps({"previous_build": old, "build": build, "age_shift_days": delta,
                      "videos_total": len(feed), "videos_new": len(fresh_v), "videos_new_by_cat": cat(fresh_v), "videos_views_updated": upd_v,
                      "shorts_total": len(shorts), "shorts_new": len(fresh_s), "shorts_new_by_cat": cat(fresh_s), "shorts_views_updated": upd_s}, ensure_ascii=False))

if __name__ == "__main__":
    main()
