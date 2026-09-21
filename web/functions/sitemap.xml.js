// Cloudflare Pages Function -- builds sitemap.xml from manifest.json, which
// pipeline/src/publish.ts writes to the same public R2 bucket alongside
// every race, listing every house/*.json and senate/*.json key currently
// live. The public r2.dev URL this reads from has no bucket-listing, so
// that manifest is the only way to enumerate races without handing this
// function R2 write credentials it doesn't otherwise need -- same
// same-origin-proxy spirit as functions/api/geocode.js, just reading a
// public bucket instead of proxying a third-party API.
const DATA_BASE = "https://pub-2c102fc0a8114f89a7afbe75818e841f.r2.dev";
const SITE_URL = "https://ballot-wise.com";

function parseHouseKey(key) {
  // districtCode in this app is never zero-padded (App.jsx's geocoder
  // formats it via String(Number(cd)), and at-large is always literally
  // "AL") -- house/NC-4.json, never house/NC-04.json.
  const m = key.match(/^house\/([A-Z]{2})-(AL|[1-9]\d*)\.json$/);
  return m ? { state: m[1], district: m[2] } : null;
}

function parseSenateKey(key) {
  const m = key.match(/^senate\/([A-Z]{2})\.json$/);
  return m ? m[1] : null;
}

// Clean paths -- /tx/senate, /nc/house-4 -- matching what
// functions/[state]/[race].js serves real per-race HTML at, and what
// parsePathUrl/buildAppUrl in src/App.jsx recognize client-side. A Senate
// race genuinely has no district of its own here, unlike the old
// query-param scheme this replaced (which required borrowing one from the
// same state's House race just to produce a URL the app would accept).
function buildUrls(raceKeys) {
  const urls = [];
  for (const key of raceKeys) {
    const house = parseHouseKey(key);
    if (house) {
      urls.push(`${SITE_URL}/${house.state.toLowerCase()}/house-${house.district.toLowerCase()}`);
      continue;
    }
    const state = parseSenateKey(key);
    if (state) urls.push(`${SITE_URL}/${state.toLowerCase()}/senate`);
  }
  return urls;
}

export async function onRequestGet() {
  let raceKeys = [];
  let lastmod = new Date().toISOString().slice(0, 10);

  try {
    const res = await fetch(`${DATA_BASE}/manifest.json`);
    if (res.ok) {
      const manifest = await res.json();
      if (Array.isArray(manifest.raceKeys)) raceKeys = manifest.raceKeys;
      if (manifest.generatedAt) lastmod = String(manifest.generatedAt).slice(0, 10);
    }
  } catch {
    // manifest.json unreachable -- fall back to just the two static pages
    // below rather than failing the whole sitemap request.
  }

  const urls = [`${SITE_URL}/`, `${SITE_URL}/about.html`, `${SITE_URL}/races`, ...buildUrls(raceKeys)];
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u.replace(/&/g, "&amp;")}</loc><lastmod>${lastmod}</lastmod></url>`).join("\n") +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
