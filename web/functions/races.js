// A real, crawlable directory of every built race. Until now the only
// path into any of the 442 individual race pages was the XML sitemap --
// which lists bare URLs with no descriptive anchor text, a much weaker
// signal than an actual page linking to each one by name. This is that:
// a plain, no-JS-required "browse all races" page, in the same spirit as
// about.html (a real, static, indexable twin of something otherwise only
// reachable through the app's own search-by-address flow).
const DATA_BASE = "https://pub-2c102fc0a8114f89a7afbe75818e841f.r2.dev";
const SITE_URL = "https://ballot-wise.com";

// Duplicated from src/App.jsx's STATE_NAMES / functions/[state]/[race].js
// -- each Pages Function deploys independently and can't import client
// source, so this small mapping is kept alongside every file that needs
// it rather than shared.
const STATE_NAMES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

function parseHouseKey(key) {
  const m = key.match(/^house\/([A-Z]{2})-(AL|[1-9]\d*)\.json$/);
  return m ? { state: m[1], district: m[2] } : null;
}

function parseSenateKey(key) {
  const m = key.match(/^senate\/([A-Z]{2})\.json$/);
  return m ? m[1] : null;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export async function onRequestGet() {
  let raceKeys = [];
  try {
    const res = await fetch(`${DATA_BASE}/manifest.json`);
    if (res.ok) {
      const manifest = await res.json();
      if (Array.isArray(manifest.raceKeys)) raceKeys = manifest.raceKeys;
    }
  } catch {
    // Falls through to an empty list -- still a valid, real page, same
    // "never 500 a crawler" stance as functions/[state]/[race].js.
  }

  // Group by state, Senate first then House districts in numeric order --
  // matches how a voter actually thinks about "what's on my ballot in
  // this state," not the raw alphabetical R2 key order manifest.json uses.
  const byState = {};
  for (const key of raceKeys) {
    const house = parseHouseKey(key);
    const senateState = parseSenateKey(key);
    const state = house?.state ?? senateState;
    if (!state) continue;
    byState[state] ??= { senate: false, districts: [] };
    if (senateState) byState[state].senate = true;
    if (house) byState[state].districts.push(house.district);
  }

  const stateSections = Object.keys(byState)
    .sort((a, b) => (STATE_NAMES[a] ?? a).localeCompare(STATE_NAMES[b] ?? b))
    .map((state) => {
      const { senate, districts } = byState[state];
      const stateName = STATE_NAMES[state] ?? state;
      const items = [];
      if (senate) items.push(`<li><a href="/${state.toLowerCase()}/senate">${escapeHtml(stateName)} Senate</a></li>`);
      [...districts]
        .sort((a, b) => (a === "AL" ? -1 : b === "AL" ? 1 : Number(a) - Number(b)))
        .forEach((d) => {
          const label = d === "AL" ? "At-Large" : `District ${d}`;
          items.push(`<li><a href="/${state.toLowerCase()}/house-${d.toLowerCase()}">${escapeHtml(stateName)} House, ${label}</a></li>`);
        });
      return `      <section>\n        <h2>${escapeHtml(stateName)}</h2>\n        <ul>\n          ${items.join("\n          ")}\n        </ul>\n      </section>`;
    })
    .join("\n");

  const title = "Browse every 2026 race — Ballot-Wise";
  const description = `Every U.S. House and Senate race Ballot-Wise has built so far, state by state — ${raceKeys.length} races, sourced from official records.`;
  const canonical = `${SITE_URL}/races`;

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: canonical,
    isPartOf: { "@type": "WebSite", name: "Ballot-Wise", url: `${SITE_URL}/` },
  });

  const body = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${canonical}" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Ballot-Wise" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${SITE_URL}/og-image.png" />
    <meta property="og:image:width" content="2400" />
    <meta property="og:image:height" content="1260" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${SITE_URL}/og-image.png" />

    <script type="application/ld+json">${jsonLd}</script>

    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;700&display=swap">
    <style>
      :root {
        --paper: #F4F1E9;
        --paper-raised: #FBFAF6;
        --ink: #211D18;
        --ink-soft: #6B6255;
        --line: #DAD2BF;
        --gold: #8C6D1F;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--paper);
        color: var(--ink);
        font-family: 'IBM Plex Sans', sans-serif;
        font-size: 15.5px;
        line-height: 1.65;
      }
      a { color: var(--gold); }
      .wrap { max-width: 760px; margin: 0 auto; padding: 28px 20px 80px; }
      header { border-bottom: 1px solid var(--line); padding-bottom: 16px; margin-bottom: 32px; }
      .wordmark { font-family: 'Fraunces', serif; font-size: 22px; letter-spacing: 0.01em; text-decoration: none; }
      .wordmark b { font-weight: 700; color: var(--ink); }
      .wordmark span { color: var(--gold); }
      .wordmark i { font-weight: 500; font-style: italic; color: var(--ink); }
      .back { display: inline-block; margin-top: 10px; font-size: 12.5px; color: var(--ink-soft); text-decoration: none; }
      .back:hover { color: var(--gold); }
      h1 { font-family: 'Fraunces', serif; font-size: 28px; font-weight: 600; margin: 0 0 10px; }
      .lead { font-size: 14.5px; color: var(--ink-soft); line-height: 1.65; margin: 0 0 34px; }
      h2 {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--ink-soft);
        margin: 0 0 8px;
      }
      section { margin-bottom: 22px; break-inside: avoid; }
      ul { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: 20px; }
      @media (min-width: 560px) { ul { columns: 3; } }
      li { font-size: 13.5px; padding: 4px 0; break-inside: avoid; }
      li a { text-decoration: none; }
      li a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <header>
        <a class="wordmark" href="/"><b>BALLOT</b><span>—</span><i>Wise</i></a>
        <div><a class="back" href="/">&larr; Find your candidates</a></div>
      </header>

      <h1>Browse every race</h1>
      <p class="lead">${raceKeys.length} U.S. House and Senate races built so far, updated weekly as primaries resolve and new data comes in.</p>

${stateSections}
    </div>
  </body>
</html>
`;

  return new Response(body, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
