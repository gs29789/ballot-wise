// Cloudflare Pages Function for "/" only -- 301s the original query-string
// race links (/?state=TX&chamber=senate, /?state=NC&district=4) to the
// clean per-race paths functions/[state]/[race].js serves. Those old links
// otherwise load the homepage shell, which Google reports as "Duplicate
// without user-selected canonical" rather than indexing them as races.
// parseAppUrl in src/App.jsx still accepts the query form client-side; this
// just makes sure a crawler (or anyone) following an old link gets moved
// to the canonical URL before that ever matters. Everything else -- the
// plain homepage included -- falls through to static serving via next().
export async function onRequestGet({ request, next }) {
  const url = new URL(request.url);
  const params = url.searchParams;
  const state = params.get("state");
  if (!state || !/^[a-z]{2}$/i.test(state)) return next();

  const chamber = params.get("chamber");
  const district = params.get("district");
  let path;
  if (chamber === "senate") {
    path = `/${state.toLowerCase()}/senate`;
  } else if (district && /^(al|[1-9]\d*)$/i.test(district)) {
    path = `/${state.toLowerCase()}/house-${district.toLowerCase()}`;
  } else {
    return next();
  }

  const profile = params.get("profile");
  const target = new URL(path, url.origin);
  if (profile) target.searchParams.set("profile", profile);
  return Response.redirect(target.toString(), 301);
}
