"""Remove ids from FEED and SHORTS. usage: drop_ids.py site.html bad.json|ids.txt.gz out.html
(a JSON array, or a gzipped text file with one id per line); a 4th argument SHORTS or FEED limits it to that list"""
import gzip, json, re, sys
site, badp, outp = sys.argv[1:4]
h = open(site, encoding="utf-8").read(); bad = set(gzip.open(badp, "rt").read().split()) if badp.endswith(".gz") else set(json.load(open(badp)))
for name in (sys.argv[4:5] or ("FEED", "SHORTS")):
    m = re.search(r'const %s = "([^"]*)";' % name, h); s = m.group(1)
    keep = "".join(s[i:i+16] for i in range(0, len(s) - 15, 16) if s[i:i+11] not in bad)
    print(name, (len(s) - len(keep)) // 16, "removed")
    h = h.replace(m.group(0), 'const %s = "%s";' % (name, keep), 1)
open(outp, "w", encoding="utf-8").write(h)
