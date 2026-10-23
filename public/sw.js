/*
 * Metricore offline shell. Lets the app open on a building site with no signal.
 * - A page is saved only when it is a real Metricore HTML page, and only after the
 *   scripts and styles it points at are saved too (a page without its scripts is blank).
 * - Saved files from older deploys are removed once a newer page is saved.
 * - Pages: network first. Only site-visit pages fall back after 4 s on weak signal;
 *   other pages wait for the network and use the saved copy only when it fails.
 * - /assets/*: content-hashed build files, served from the saved copy when there is one.
 * Supabase, analytics and every other site are never touched.
 */
const CACHE = 'metricore-shell-v3';
const SHELL = '/';

function assetsIn(html) {
  const out = new Set();
  const re = /(?:src|href)="(\/assets\/[^"]+)"/g;
  let m;
  while ((m = re.exec(html))) out.add(m[1]);
  return [...out];
}

/** Save the page and everything it loads; then drop build files no longer used. */
async function saveShell(res) {
  const type = res.headers.get('content-type') || '';
  if (!res.ok || !type.includes('text/html')) return;
  const html = await res.clone().text();
  if (!html.includes('id="root"')) return; // not the app (a demo video page, an error page)
  const cache = await caches.open(CACHE);
  const assets = assetsIn(html);
  await Promise.all(assets.map(async (a) => {
    if (await cache.match(a, { ignoreVary: true })) return;
    const r = await fetch(a, { cache: 'no-cache' });
    if (!r.ok) throw new Error('asset ' + a);
    await cache.put(a, r);
  }));
  await cache.put(SHELL, res.clone());
  const keep = new Set(assets);
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  for (const req of await cache.keys()) {
    const p = new URL(req.url).pathname;
    if (!p.startsWith('/assets/') || keep.has(p)) continue;
    // screens opened later (lazy chunks) are kept a week; older deploys' files go
    const hit = await cache.match(req);
    const when = hit && Date.parse(hit.headers.get('date') || '');
    if (!when || when < weekAgo) await cache.delete(req);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch(SHELL, { cache: 'no-cache' }).then(saveShell).catch(() => {})
      .then(() => caches.open(CACHE)).then((c) => c.add('/manifest.json')).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate' && req.destination === 'document') {
    const onSite = url.pathname.startsWith('/site');
    const network = fetch(req).then((res) => { event.waitUntil(saveShell(res.clone()).catch(() => {})); return res; });
    event.respondWith(
      (onSite ? Promise.race([network, timeout(4000)]) : network)
        .catch(() => caches.match(SHELL, { ignoreVary: true }).then((hit) => hit || network)),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      // ignoreVary: module scripts are requested with an Origin header the saved copy lacks
      caches.match(req, { ignoreVary: true }).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
  }
  // everything else: straight to the network, as before
});
