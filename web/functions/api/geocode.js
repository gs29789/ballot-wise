// Cloudflare Pages Function — same-origin proxy for the Census Geocoder.
// The Census API sends no Access-Control-Allow-Origin header, so it cannot be
// called directly from a browser; this is the smallest fix, not a general
// backend (no database, no per-request business logic — just a passthrough).
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
  const upstream = `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=${encodeURIComponent(
    address
  )}&benchmark=Public_AR_Current&vintage=Current_Current&layers=Congressional+Districts&format=json`;

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
  return new Response(result.body, {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" },
  });
}
