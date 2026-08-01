// Cloudflare Pages Function — same-origin proxy for the Census Geocoder.
// The Census API sends no Access-Control-Allow-Origin header, so it cannot be
// called directly from a browser; this is the smallest fix, not a general
// backend (no database, no per-request business logic — just a passthrough).
export async function onRequestGet({ request }) {
  const address = new URL(request.url).searchParams.get("address");
  if (!address) {
    return new Response(JSON.stringify({ error: "address query param required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const upstream = `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=${encodeURIComponent(
    address
  )}&benchmark=Public_AR_Current&vintage=Current_Current&layers=Congressional+Districts&format=json`;

  const res = await fetch(upstream);
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { "content-type": "application/json", "cache-control": "public, max-age=86400" },
  });
}
