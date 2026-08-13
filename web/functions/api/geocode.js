// Cloudflare Pages Function — same-origin proxy for the Census Geocoder.
// The Census API sends no Access-Control-Allow-Origin header, so it cannot be
// called directly from a browser; this is the smallest fix, not a general
// backend (no database — the one exception is the North Carolina district
// correction below, added because Census's own data is confirmed stale).
//
// Census's own WAF intermittently rejects a fraction of requests routed
// through Cloudflare's shared edge IP ranges — confirmed by hand: 3 of 5
// rapid direct requests succeeded, 2 returned an F5 BIG-IP block page
// ("Request Rejected... Support ID"), still with HTTP 200. That's Census's
// infrastructure, not something fixable from this side, but since it's
// clearly probabilistic rather than a hard block, one retry meaningfully
// improves real-world reliability. The block page's HTTP 200 is also why
// this must actually inspect the body — trusting upstream's status code
// alone would treat a block page as success.
async function fetchGeographies(address) {
  // "Congressional Districts" is NOT a real Census layer name (the actual
  // one is "119th Congressional Districts") — confirmed directly, 2026-08-13:
  // requesting it alone happened to work only because Census silently falls
  // back to returning EVERY layer when it doesn't recognize the one asked
  // for, which is also how "States" (read by the frontend for STUSAB) was
  // showing up despite never being explicitly requested. That fallback
  // breaks the moment a second, VALID layer name ("Counties", needed for
  // the North Carolina correction below) is added to the request — Census
  // then returns ONLY the layers it actually recognized, silently dropping
  // both the misspelled one AND anything that was only ever present via the
  // fallback. Caught by testing the real response shape before shipping:
  // an early version of this fix requested just the two layers this file
  // actually reads and silently broke every state's lookup, not just NC's,
  // because "States" was never in the fallback-dependent original request
  // either. All three needed layers are now named explicitly.
  const upstream = `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=${encodeURIComponent(
    address
  )}&benchmark=Public_AR_Current&vintage=Current_Current&layers=States,119th+Congressional+Districts,Counties&format=json`;

  const res = await fetch(upstream, {
    headers: { "User-Agent": "ballot-wise.com/0.1 (voter information site; contact via GitHub repo)" },
  });
  const body = await res.text();
  // The WAF block page itself claims "content-type: application/json" —
  // confirmed by hand, so that header can't be trusted to tell a real
  // response apart from a block page. Only the actual body shape can.
  const looksLikeJson = body.trimStart().startsWith("{");
  return { ok: res.ok && looksLikeJson, body, status: res.status };
}

// North Carolina redrew its congressional map for 2026 (N.C. Sess. Law
// 2025-95, codified at N.C. Gen. Stat. § 163-201) — legally in effect for
// the 2026 primary and general election, upheld against injunction by a
// three-judge federal panel (Nov-Dec 2025). But the Census Geocoder's
// Current_Current vintage still serves the OLD (pre-2025) district
// boundaries — confirmed directly, 2026-08-13: a Craven County address
// (300 Pollock St, New Bern) returns the old District 3 instead of the new
// District 1. This table is a manual correction for the counties where
// that's safe to do: confirmed against the statute's own block-level text
// that each of these counties is assigned WHOLLY to one district (no VTD or
// Block qualifier after the county name) — a simple county-name lookup is
// exact for these, not an approximation. Counties split between multiple
// districts (Cabarrus, Chatham, Cumberland, Forsyth, Granville, Guilford,
// Mecklenburg, Onslow, Polk, Robeson, Sampson, Wake) are deliberately left
// OUT of this table — a county-level correction can't safely resolve which
// side of a split county a given address falls on, so those addresses keep
// whatever the (possibly still-stale) Census geocoder returns, same open
// risk as before this fix. 88 whole counties + 12 split counties = North
// Carolina's 100 counties, reconciled against the statute text exactly.
const NC_STATE_FIPS = "37";
const NC_COUNTY_TO_DISTRICT_2026 = {
  Beaufort: "01", Bertie: "01", Camden: "01", Carteret: "01", Chowan: "01",
  Craven: "01", Currituck: "01", Dare: "01", Edgecombe: "01", Gates: "01",
  Halifax: "01", Hertford: "01", Hyde: "01", Martin: "01", Nash: "01",
  Northampton: "01", Pamlico: "01", Pasquotank: "01", Perquimans: "01",
  Tyrrell: "01", Vance: "01", Warren: "01", Washington: "01",
  Duplin: "03", Greene: "03", Jones: "03", Lenoir: "03", Pitt: "03", Wayne: "03", Wilson: "03",
  Durham: "04", Orange: "04",
  Alexander: "05", Alleghany: "05", Ashe: "05", Caldwell: "05", Rockingham: "05",
  Stokes: "05", Surry: "05", Watauga: "05", Wilkes: "05",
  Davidson: "06", Davie: "06", Rowan: "06",
  Bladen: "07", Brunswick: "07", Columbus: "07", "New Hanover": "07", Pender: "07",
  Anson: "08", Montgomery: "08", Richmond: "08", Scotland: "08", Stanly: "08", Union: "08",
  Alamance: "09", Hoke: "09", Moore: "09", Randolph: "09",
  Catawba: "10", Iredell: "10", Lincoln: "10", Yadkin: "10",
  Avery: "11", Buncombe: "11", Cherokee: "11", Clay: "11", Graham: "11", Haywood: "11",
  Henderson: "11", Jackson: "11", Macon: "11", Madison: "11", McDowell: "11",
  Mitchell: "11", Swain: "11", Transylvania: "11", Yancey: "11",
  Caswell: "13", Franklin: "13", Harnett: "13", Johnston: "13", Lee: "13", Person: "13",
  Burke: "14", Cleveland: "14", Gaston: "14", Rutherford: "14",
};

// Mutates each addressMatch's Congressional District entry in place when
// the address is a mapped (whole, unsplit) North Carolina county. Silently
// no-ops for every other case — wrong state, split county, missing county
// data, malformed body — so a Census response shape this doesn't expect
// just passes through unmodified rather than breaking the request.
function correctNorthCarolina(body) {
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    return body;
  }
  const matches = data?.result?.addressMatches;
  if (!Array.isArray(matches)) return body;
  for (const match of matches) {
    if (match.geographies?.States?.[0]?.STUSAB !== "NC") continue;
    const county = match.geographies?.Counties?.[0]?.BASENAME;
    const correctDistrict = county && NC_COUNTY_TO_DISTRICT_2026[county];
    if (!correctDistrict) continue;
    const district = match.geographies?.["119th Congressional Districts"]?.[0];
    if (!district) continue;
    district.CD119 = correctDistrict;
    district.NAME = `Congressional District ${Number(correctDistrict)}`;
    district.GEOID = `${NC_STATE_FIPS}${correctDistrict}`;
    district.BASENAME = String(Number(correctDistrict));
  }
  return JSON.stringify(data);
}

export async function onRequestGet({ request }) {
  const address = new URL(request.url).searchParams.get("address");
  if (!address) {
    return new Response(JSON.stringify({ error: "address query param required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  let result = await fetchGeographies(address);
  if (!result.ok) result = await fetchGeographies(address);

  if (!result.ok) {
    return new Response(JSON.stringify({ error: "Address lookup service is temporarily unavailable. Please try again in a moment." }), {
      status: 502,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  // 1 hour, not 24 — a bad response that ever slips past the looksLikeJson
  // check (block page format changes, a new upstream failure shape, etc.)
  // should self-heal within the hour rather than sticking at the edge for a day.
  return new Response(correctNorthCarolina(result.body), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" },
  });
}
