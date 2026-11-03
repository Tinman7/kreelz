/* KREELZ service worker (per David 2026-11-03: the site installable as an app, kreelz.com and kreelz.com/jp).
   Kept deliberately small: pages always come from the network first (the site changes every midnight), a copy is kept
   only so the app still opens offline; everything else (titles, data, YouTube) is left to the browser as usual.
   Push messages (daily "today's top 10") are shown here once push is set up. */
const CACHE = "kz-pages-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET" || r.mode !== "navigate" || new URL(r.url).origin !== location.origin) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(r);
      if (res.ok) { const c = await caches.open(CACHE); c.put(new URL(r.url).pathname, res.clone()).catch(() => {}); }
      return res;
    } catch (err) {
      const hit = await caches.match(new URL(r.url).pathname) || await caches.match(new URL(r.url).pathname.startsWith("/jp/") ? "/jp/" : "/");
      return hit || new Response("<meta charset=utf-8><p style='font:16px system-ui;padding:24px'>Offline · オフライン</p>", { headers: { "content-type": "text/html" } });
    }
  })());
});
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "KREELZ", { body: d.body || "", icon: d.icon || "/icons/icon-192.png", badge: "/icons/maskable-192.png", data: { url: d.url || "/" }, tag: d.tag || "kz-daily" }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil((async () => {
    for (const c of await self.clients.matchAll({ type: "window", includeUncontrolled: true })) if (c.url.includes(url) && "focus" in c) return c.focus();
    return self.clients.openWindow(url);
  })());
});
