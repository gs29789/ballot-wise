// Cloudflare Pages Function -- real, crawlable HTML at clean per-race URLs
// (/tx/senate, /nc/house-4 -- see parsePathUrl/buildAppUrl in src/App.jsx
// for the matching client-side shapes, and sitemap.xml.js, which lists
// exactly these URLs).
//
// This fetches the same public R2 race JSON the client app fetches, so a
// page here is always exactly as fresh as the live data -- no separate
// build step to keep in sync, and no risk of a pre-rendered copy going
// stale between weekly pipeline refreshes. The alternative (baking race
// pages into the Vite build) would need every pipeline publish to also
// trigger a fresh Pages deploy, which nothing currently wires up -- see
// pipeline/src/publish.ts and .github/workflows/weekly-sync.yml, neither
// of which touch web/'s own deploy.
//
// The response is real, substantive content (candidate names, party,
// incumbency), not just meta tags -- a crawler or link-unfurler that never
// runs JS still sees something worth indexing or previewing. A visitor
// with JS enabled gets handed into the full interactive app via the same
// bundle index.html already loads (read from the live index.html rather
// than hardcoded, since its filename is content-hashed and changes on
// every Vite build).
//
// One collision to be aware of: this route is /:state/:race, and
// /api/geocode technically also has two path segments. Cloudflare Pages
// Functions route static/literal segments (functions/api/geocode.js)
// ahead of dynamic ones ([state]) at the same position, so /api/* should
// never actually reach this file -- worth confirming on the first real
// deploy, since it can't be exercised locally. The state-code shape check
// below (two letters only) is a second, independent line of defense: "api"
// is three letters, so even if routing precedence somehow didn't hold,
// this file would decline it rather than serve something confusing.
const DATA_BASE = "https://pub-2c102fc0a8114f89a7afbe75818e841f.r2.dev";
const SITE_URL = "https://ballot-wise.com";

function parseRaceParam(state, race) {
  if (!/^[a-z]{2}$/i.test(state)) return null;
  const stusab = state.toUpperCase();
  if (/^senate$/i.test(race)) return { stusab, chamber: "senate" };
  const m = /^house-(al|[1-9]\d*)$/i.exec(race);
  if (m) return { stusab, chamber: "house", district: /^al$/i.test(m[1]) ? "AL" : m[1] };
  return null;
}

// FEC names come as "LAST, FIRST MIDDLE" -- same transform as toTitleCase
// in src/App.jsx, duplicated here because this Function runs in the
// Workers runtime as a separate deploy unit from the Vite app and can't
// import client source directly.
function toTitleCase(fecName) {
  const [last, rest] = fecName.split(",").map((s) => s.trim());
  const cap = (s) => s.split(/\s+/).map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
  return rest ? `${cap(rest)} ${cap(last)}` : cap(last);
}

// Same bucketing as partyLabel in src/App.jsx -- kept independent for the
// same reason as toTitleCase above.
function partyLabel(fecPartyFull) {
  if (!fecPartyFull || /^independent$/i.test(fecPartyFull.trim())) return "Independent";
  if (/republican/i.test(fecPartyFull)) return "Republican";
  if (/democrat/i.test(fecPartyFull)) return "Democrat";
  if (/libertarian/i.test(fecPartyFull)) return "Libertarian";
  if (/green/i.test(fecPartyFull)) return "Green";
  return fecPartyFull
    .replace(/\bparty\b/i, "")
    .replace(/^[\s-]+|[\s-]+$/g, "")
    .split(/\s+/)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

// USPS state abbreviation -> full name. Duplicated from src/App.jsx's
// STATE_NAMES for the same reason as toTitleCase/partyLabel above: this
// Function runs as a separate deploy unit and can't import client source.
// Full names matter here specifically because this drives real
// search-facing text (title, meta description, H1) -- "TX Senate
// candidates" isn't how anyone actually searches; "Texas Senate
// candidates" is.
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

// Ranks candidates by how likely a searcher is to look them up by name --
// incumbents first (already a known quantity to voters), then by total
// raised (a real, sourced signal of a serious campaign, not a guess at
// who's "leading"). Picks which names go in the title/H1 when a race has
// more contenders than fit there. Unlike the old "only if the race has
// 2-3 candidates total" rule, this always surfaces the top real names
// when there are any -- which matters most for exactly the multi-
// candidate races (often the more contested, more-searched ones) that
// used to lose their names entirely in favor of a generic title.
function topCandidates(candidates) {
  return [...candidates].sort((a, b) => {
    if (!!a.incumbent !== !!b.incumbent) return a.incumbent ? -1 : 1;
    return (b.financials?.totalRaised ?? 0) - (a.financials?.totalRaised ?? 0);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Reads the currently-deployed index.html to find its module script tag,
// rather than hardcoding a path -- /src/main.jsx only resolves in Vite's
// dev server, and the production build's real entry is a content-hashed
// filename (dist/assets/main-[hash].js) that changes on every deploy this
// Function has no build-time visibility into.
async function currentAppScriptTag(origin) {
  try {
    const res = await fetch(`${origin}/index.html`);
    if (!res.ok) return null;
    const html = await res.text();
    const m = /<script[^>]+type="module"[^>]+src="([^"]+)"[^>]*><\/script>/.exec(html);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function renderPage({ stusab, chamber, district, race, canonical, scriptSrc }) {
  // "House" is spelled out here for the same reason as raceMetaTitle in
  // src/App.jsx: this exact string drives the title AND the visible <h1>
  // below, and nothing else on the page names the chamber for a House race.
  const stateName = STATE_NAMES[stusab] ?? stusab;
  const where = chamber === "house" ? `${stateName} House District ${district === "AL" ? "At-Large" : district}` : `${stateName} Senate`;
  const candidates = race?.candidates ?? [];

  const [first, second, ...rest] = topCandidates(candidates);
  const title = second
    ? `${toTitleCase(first.full_name)} vs. ${toTitleCase(second.full_name)}${rest.length ? ` +${rest.length} more` : ""} — ${where} 2026 | Ballot-Wise`
    : first
    ? `${toTitleCase(first.full_name)} — ${where} 2026 | Ballot-Wise`
    : `${where} 2026 Candidates Compared | Ballot-Wise`;

  const description = candidates.length
    ? `Compare ${candidates.length} candidate${candidates.length === 1 ? "" : "s"} running for ${chamber === "house" ? "the U.S. House" : "U.S. Senate"} in ${where} — voting records, campaign finance, and public statements, sourced from official records.`
    : `${where}, 2026 — sourced, non-partisan candidate comparison from Ballot-Wise. No built race here yet; data updates weekly.`;

  const candidateListHtml = candidates.length
    ? candidates
        .map((c) => `<li><strong>${escapeHtml(toTitleCase(c.full_name))}</strong> — ${escapeHtml(partyLabel(c.party))}${c.incumbent ? " · Incumbent" : ""}</li>`)
        .join("\n        ")
    : `<li>No candidates built for this race yet — check back as data updates weekly.</li>`;

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: canonical,
    isPartOf: { "@type": "WebSite", name: "Ballot-Wise", url: `${SITE_URL}/` },
  });

  return `<!doctype html>
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
      body { margin: 0; background: #F4F1E9; color: #211D18; font-family: 'IBM Plex Sans', sans-serif; font-size: 15.5px; line-height: 1.6; }
      .wrap { max-width: 640px; margin: 0 auto; padding: 28px 20px 80px; }
      a.wordmark { font-family: 'Fraunces', serif; font-size: 22px; text-decoration: none; }
      a.wordmark b { font-weight: 700; color: #211D18; }
      a.wordmark span { color: #8C6D1F; }
      a.wordmark i { font-weight: 500; font-style: italic; color: #211D18; }
      h1 { font-family: 'Fraunces', serif; font-size: 26px; font-weight: 600; margin: 24px 0 6px; }
      .sub { color: #6B6255; font-size: 13.5px; margin: 0 0 24px; }
      ul { list-style: none; margin: 0 0 24px; padding: 0; border-top: 1px dashed #DAD2BF; }
      li { padding: 10px 0; border-bottom: 1px dashed #DAD2BF; font-size: 14px; }
      .cta { display: inline-block; background: #211D18; color: #F4F1E9; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-size: 14px; font-weight: 500; }
    </style>
  </head>
  <body>
    <div id="root">
      <div class="wrap">
        <a class="wordmark" href="/"><b>BALLOT</b><span>—</span><i>Wise</i></a>
        <h1>${escapeHtml(where)}, 2026</h1>
        <p class="sub">Sourced from official public records — FEC filings, Congress.gov, and each candidate's own campaign site. Non-partisan, funded by readers, not campaigns.</p>
        <ul>
        ${candidateListHtml}
        </ul>
        <!-- Not a link to this same race: once the script below runs, this
             exact page already becomes the full interactive comparison (see
             parsePathUrl in src/App.jsx, which recognizes this same clean
             URL and loads this race automatically). This CTA only matters
             as a fallback for a visitor without JS, so it points somewhere
             that's actually a different, useful next step. -->
        <a class="cta" href="/">Search your own address →</a>
      </div>
    </div>
    ${scriptSrc ? `<script type="module" src="${escapeHtml(scriptSrc)}"></script>` : ""}
  </body>
</html>
`;
}

export async function onRequestGet({ params, request, next }) {
  const parsed = parseRaceParam(params.state, params.race);
  // Any two-segment path this function doesn't recognize as a real
  // state/race pair -- most importantly /assets/<hashed-file>.js, which
  // structurally fits :state/:race exactly like a real candidate route
  // does -- must fall through to Cloudflare's static-asset serving via
  // next(), not return a 404 Response directly. A direct 404 here is
  // terminal: it swallows the request before Pages ever gets to check
  // whether a real static file exists at that path, which is what broke
  // the production JS bundle (and would break any other top-level static
  // asset) the moment this function was deployed.
  if (!parsed) return next();

  const { stusab, chamber, district } = parsed;
  const key = chamber === "house" ? `house/${stusab}-${district}.json` : `senate/${stusab}.json`;

  let race = null;
  try {
    const res = await fetch(`${DATA_BASE}/${key}`);
    if (res.ok) race = await res.json();
  } catch {
    // Falls through with race = null, rendered as "not built yet" below
    // rather than a 500 -- a visitor (and a crawler) still gets a real,
    // correctly-titled page either way.
  }

  const origin = new URL(request.url).origin;
  const appUrl = chamber === "house" ? `/${stusab.toLowerCase()}/house-${district.toLowerCase()}` : `/${stusab.toLowerCase()}/senate`;
  const canonical = `${SITE_URL}${appUrl}`;
  const scriptSrc = await currentAppScriptTag(origin);

  return new Response(renderPage({ stusab, chamber, district, race, canonical, scriptSrc }), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=1800" },
  });
}
