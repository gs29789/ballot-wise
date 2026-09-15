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

// The app's own URL scheme (buildAppUrl/parseAppUrl in src/App.jsx) treats
// a URL with no &district= as invalid and refuses to deep-link at all --
// true even for a Senate race, which has no district of its own. Rather
// than change that shared parsing logic on the strength of a sitemap
// generator's needs, a Senate race's sitemap URL borrows that same state's
// own House district so the link is genuinely functional. A state with no
// House race built yet has nothing to borrow, so its Senate race is left
// out of the sitemap rather than pointed at a guessed district number --
// the same "no source, no field" standard the rest of this site holds to.
function buildUrls(raceKeys) {
  const houseDistrictByState = new Map();
  const urls = [];

  for (const key of raceKeys) {
    const house = parseHouseKey(key);
    if (!house) continue;
    urls.push(`${SITE_URL}/?state=${house.state}&district=${house.district}&chamber=house`);
    if (!houseDistrictByState.has(house.state)) houseDistrictByState.set(house.state, house.district);
  }

  for (const key of raceKeys) {
    const state = parseSenateKey(key);
    if (!state) continue;
    const district = houseDistrictByState.get(state);
    if (!district) continue;
    urls.push(`${SITE_URL}/?state=${state}&district=${district}&chamber=senate`);
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

  const urls = [`${SITE_URL}/`, `${SITE_URL}/about.html`, ...buildUrls(raceKeys)];
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
