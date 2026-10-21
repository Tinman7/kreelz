// Thumbnail check: a short needs oardefault or hqdefault, a long video needs mqdefault (or hqdefault).
// i.ytimg.com returns 404 (with a small grey placeholder) when a video has no thumbnail.
async function ok(url) {
  for (let t = 0; t < 3; t++) {
    try { const r = await fetch(url, { method: "HEAD" });
          if (r.status === 200) return true;
          if (r.status === 404) return false; } catch (e) {}
    await new Promise(s => setTimeout(s, 1000 * (t + 1)));
  }
  return true;                                   // network trouble: don't drop on a guess
}
export async function hasThumb(id, kind) {
  const base = `https://i.ytimg.com/vi/${id}/`;
  const first = kind === "s" ? "oardefault.jpg" : "mqdefault.jpg";
  return (await ok(base + first)) || (await ok(base + "hqdefault.jpg"));
}
