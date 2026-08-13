// Cloudflare Pages Function — same-origin proxy for the Census Geocoder.
// The Census API sends no Access-Control-Allow-Origin header, so it cannot be
// called directly from a browser; this is the smallest fix, not a general
// backend (no database — the one exception is the stale-district correction
// below, added because Census's own data is confirmed stale for several
// states that redrew their maps for 2026).
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

// Five states were confirmed 2026-08-13 to share the exact same blocker
// that excluded Texas from this project earlier: each enacted a genuinely
// new, legally-in-effect 2026 congressional map, but the Census Geocoder's
// Current_Current vintage still serves the OLD (pre-redraw) district
// boundaries — confirmed directly for each with a real test address (e.g.
// NC's Craven County resolves to the old District 3 instead of the new
// District 1). Missouri, Ohio, Florida, and North Carolina turned out to
// have an official, sufficiently precise TEXTUAL source (a statute or
// commission-filed legal description) that explicitly distinguishes a
// county assigned WHOLLY to one district from a county SPLIT between
// districts — for those states, a plain county-level correction is exact,
// not an approximation, for every whole county. Utah does not: its map was
// adopted by court order and exists only as a GIS shapefile with no
// textual county-by-district breakdown, so no override was attempted there.
//
// Keyed by Census county GEOID (state FIPS + county FIPS), NOT county name
// — confirmed necessary, not just tidier: Missouri's independent "St.
// Louis city" and its separate, different "St. Louis County" both return
// the identical Census BASENAME ("St. Louis"), distinguishable only by
// COUNTY FIPS (510 vs 189) or the NAME field's city/County suffix. A
// name-keyed lookup would have silently confused the two.
//
// Every whole-county entry below was cross-referenced against the Census
// Bureau's own authoritative national county reference
// (www2.census.gov/geo/docs/reference/codes2020/national_county2020.txt)
// and reconciled to each state's full, independently-known county count
// with zero gaps and zero duplicates (NC 88+12=100, MO 110+5=115 incl. the
// independent City of St. Louis, OH 73+15=88, FL 48+19=67). Counties split
// between districts are deliberately left OUT of every table below — a
// county-level correction can't safely resolve which side of a split
// county a given address falls on, so those addresses keep whatever the
// (possibly still-stale) Census geocoder returns, same open risk as
// before this fix.
//
// Sources (all independently fetched and spot-checked against the actual
// PDF/document text, not just trusted from secondary reporting):
//   NC: N.C. Gen. Stat. § 163-201, https://law.justia.com/codes/north-carolina/chapter-163/article-17/section-163-201/
//   MO: RSMo §§128.471-128.479 (2025 HB1, 2nd Extraordinary Session), https://documents.house.mo.gov/billtracking/bills254/hlrbillspdf/3344H.01T.pdf
//   OH: "Description of Ohio's Congressional District Plan", adopted by the Ohio Redistricting Commission 2025-10-31 — live URL is Cloudflare-gated, use https://web.archive.org/web/20260422123849/https://www.ohiosos.gov/assets/uscongressionaldistricts-2026-2032-adopted-2025-10-31-legaldescription.pdf
//   FL: s. 8.0002, Fla. Stat., as rewritten by HB 1D (2026D Special Session), https://www.flsenate.gov/Session/Bill/2026D/1D/BillText/er/PDF
const STATE_COUNTY_DISTRICT_OVERRIDES_2026 = {
  NC: {
    "37001": "09", // Alamance County
    "37003": "05", // Alexander County
    "37005": "05", // Alleghany County
    "37007": "08", // Anson County
    "37009": "05", // Ashe County
    "37011": "11", // Avery County
    "37013": "01", // Beaufort County
    "37015": "01", // Bertie County
    "37017": "07", // Bladen County
    "37019": "07", // Brunswick County
    "37021": "11", // Buncombe County
    "37023": "14", // Burke County
    "37027": "05", // Caldwell County
    "37029": "01", // Camden County
    "37031": "01", // Carteret County
    "37033": "13", // Caswell County
    "37035": "10", // Catawba County
    "37039": "11", // Cherokee County
    "37041": "01", // Chowan County
    "37043": "11", // Clay County
    "37045": "14", // Cleveland County
    "37047": "07", // Columbus County
    "37049": "01", // Craven County
    "37053": "01", // Currituck County
    "37055": "01", // Dare County
    "37057": "06", // Davidson County
    "37059": "06", // Davie County
    "37061": "03", // Duplin County
    "37063": "04", // Durham County
    "37065": "01", // Edgecombe County
    "37069": "13", // Franklin County
    "37071": "14", // Gaston County
    "37073": "01", // Gates County
    "37075": "11", // Graham County
    "37079": "03", // Greene County
    "37083": "01", // Halifax County
    "37085": "13", // Harnett County
    "37087": "11", // Haywood County
    "37089": "11", // Henderson County
    "37091": "01", // Hertford County
    "37093": "09", // Hoke County
    "37095": "01", // Hyde County
    "37097": "10", // Iredell County
    "37099": "11", // Jackson County
    "37101": "13", // Johnston County
    "37103": "03", // Jones County
    "37105": "13", // Lee County
    "37107": "03", // Lenoir County
    "37109": "10", // Lincoln County
    "37111": "11", // McDowell County
    "37113": "11", // Macon County
    "37115": "11", // Madison County
    "37117": "01", // Martin County
    "37121": "11", // Mitchell County
    "37123": "08", // Montgomery County
    "37125": "09", // Moore County
    "37127": "01", // Nash County
    "37129": "07", // New Hanover County
    "37131": "01", // Northampton County
    "37135": "04", // Orange County
    "37137": "01", // Pamlico County
    "37139": "01", // Pasquotank County
    "37141": "07", // Pender County
    "37143": "01", // Perquimans County
    "37145": "13", // Person County
    "37147": "03", // Pitt County
    "37151": "09", // Randolph County
    "37153": "08", // Richmond County
    "37157": "05", // Rockingham County
    "37159": "06", // Rowan County
    "37161": "14", // Rutherford County
    "37165": "08", // Scotland County
    "37167": "08", // Stanly County
    "37169": "05", // Stokes County
    "37171": "05", // Surry County
    "37173": "11", // Swain County
    "37175": "11", // Transylvania County
    "37177": "01", // Tyrrell County
    "37179": "08", // Union County
    "37181": "01", // Vance County
    "37185": "01", // Warren County
    "37187": "01", // Washington County
    "37189": "05", // Watauga County
    "37191": "03", // Wayne County
    "37193": "05", // Wilkes County
    "37195": "03", // Wilson County
    "37197": "10", // Yadkin County
    "37199": "11", // Yancey County
  },
  MO: {
    "29001": "06", // Adair County
    "29003": "06", // Andrew County
    "29005": "06", // Atchison County
    "29007": "03", // Audrain County
    "29009": "07", // Barry County
    "29011": "04", // Barton County
    "29013": "04", // Bates County
    "29015": "04", // Benton County
    "29017": "08", // Bollinger County
    "29021": "06", // Buchanan County
    "29023": "08", // Butler County
    "29025": "06", // Caldwell County
    "29027": "03", // Callaway County
    "29029": "04", // Camden County
    "29031": "08", // Cape Girardeau County
    "29033": "06", // Carroll County
    "29035": "08", // Carter County
    "29037": "04", // Cass County
    "29039": "04", // Cedar County
    "29041": "06", // Chariton County
    "29043": "07", // Christian County
    "29045": "06", // Clark County
    "29047": "06", // Clay County
    "29049": "06", // Clinton County
    "29051": "05", // Cole County
    "29053": "05", // Cooper County
    "29055": "02", // Crawford County
    "29057": "04", // Dade County
    "29059": "04", // Dallas County
    "29061": "06", // Daviess County
    "29063": "06", // DeKalb County
    "29065": "08", // Dent County
    "29067": "08", // Douglas County
    "29069": "08", // Dunklin County
    "29071": "02", // Franklin County
    "29073": "02", // Gasconade County
    "29075": "06", // Gentry County
    "29077": "07", // Greene County
    "29079": "06", // Grundy County
    "29081": "06", // Harrison County
    "29083": "04", // Henry County
    "29085": "04", // Hickory County
    "29087": "06", // Holt County
    "29089": "05", // Howard County
    "29091": "08", // Howell County
    "29093": "08", // Iron County
    "29097": "07", // Jasper County
    "29101": "05", // Johnson County
    "29103": "06", // Knox County
    "29105": "04", // Laclede County
    "29107": "05", // Lafayette County
    "29109": "07", // Lawrence County
    "29111": "06", // Lewis County
    "29113": "03", // Lincoln County
    "29115": "06", // Linn County
    "29117": "06", // Livingston County
    "29119": "07", // McDonald County
    "29121": "06", // Macon County
    "29123": "08", // Madison County
    "29125": "05", // Maries County
    "29127": "06", // Marion County
    "29129": "06", // Mercer County
    "29131": "05", // Miller County
    "29133": "08", // Mississippi County
    "29135": "05", // Moniteau County
    "29137": "03", // Monroe County
    "29139": "03", // Montgomery County
    "29141": "05", // Morgan County
    "29143": "08", // New Madrid County
    "29145": "07", // Newton County
    "29147": "06", // Nodaway County
    "29149": "08", // Oregon County
    "29151": "05", // Osage County
    "29153": "08", // Ozark County
    "29155": "08", // Pemiscot County
    "29157": "08", // Perry County
    "29159": "05", // Pettis County
    "29161": "08", // Phelps County
    "29163": "03", // Pike County
    "29165": "06", // Platte County
    "29167": "04", // Polk County
    "29169": "04", // Pulaski County
    "29171": "06", // Putnam County
    "29173": "03", // Ralls County
    "29175": "05", // Randolph County
    "29177": "06", // Ray County
    "29179": "08", // Reynolds County
    "29181": "08", // Ripley County
    "29183": "03", // St. Charles County
    "29185": "04", // St. Clair County
    "29186": "08", // Ste. Genevieve County
    "29187": "08", // St. Francois County
    "29195": "05", // Saline County
    "29197": "06", // Schuyler County
    "29199": "06", // Scotland County
    "29201": "08", // Scott County
    "29203": "08", // Shannon County
    "29205": "06", // Shelby County
    "29207": "08", // Stoddard County
    "29209": "07", // Stone County
    "29211": "06", // Sullivan County
    "29213": "07", // Taney County
    "29215": "08", // Texas County
    "29217": "04", // Vernon County
    "29219": "03", // Warren County
    "29221": "02", // Washington County
    "29223": "08", // Wayne County
    "29227": "06", // Worth County
    "29229": "08", // Wright County
    "29510": "01", // St. Louis city
  },
  OH: {
    "39001": "02", // Adams County
    "39003": "04", // Allen County
    "39005": "07", // Ashland County
    "39007": "14", // Ashtabula County
    "39009": "02", // Athens County
    "39011": "04", // Auglaize County
    "39013": "06", // Belmont County
    "39015": "02", // Brown County
    "39019": "06", // Carroll County
    "39021": "04", // Champaign County
    "39025": "02", // Clermont County
    "39027": "01", // Clinton County
    "39029": "06", // Columbiana County
    "39031": "12", // Coshocton County
    "39033": "05", // Crawford County
    "39037": "08", // Darke County
    "39039": "09", // Defiance County
    "39043": "09", // Erie County
    "39045": "12", // Fairfield County
    "39047": "15", // Fayette County
    "39051": "09", // Fulton County
    "39053": "02", // Gallia County
    "39055": "14", // Geauga County
    "39057": "10", // Greene County
    "39059": "12", // Guernsey County
    "39063": "05", // Hancock County
    "39065": "04", // Hardin County
    "39067": "06", // Harrison County
    "39069": "09", // Henry County
    "39071": "15", // Highland County
    "39073": "02", // Hocking County
    "39077": "05", // Huron County
    "39079": "02", // Jackson County
    "39081": "06", // Jefferson County
    "39083": "12", // Knox County
    "39085": "14", // Lake County
    "39087": "02", // Lawrence County
    "39089": "12", // Licking County
    "39091": "04", // Logan County
    "39093": "05", // Lorain County
    "39095": "09", // Lucas County
    "39097": "15", // Madison County
    "39101": "04", // Marion County
    "39103": "07", // Medina County
    "39105": "02", // Meigs County
    "39107": "04", // Mercer County
    "39111": "12", // Monroe County
    "39113": "10", // Montgomery County
    "39115": "02", // Morgan County
    "39117": "04", // Morrow County
    "39119": "12", // Muskingum County
    "39121": "12", // Noble County
    "39123": "09", // Ottawa County
    "39125": "09", // Paulding County
    "39129": "15", // Pickaway County
    "39131": "02", // Pike County
    "39135": "08", // Preble County
    "39137": "09", // Putnam County
    "39141": "02", // Ross County
    "39143": "05", // Sandusky County
    "39145": "02", // Scioto County
    "39147": "05", // Seneca County
    "39149": "04", // Shelby County
    "39153": "13", // Summit County
    "39155": "14", // Trumbull County
    "39157": "06", // Tuscarawas County
    "39159": "04", // Union County
    "39161": "04", // Van Wert County
    "39163": "02", // Vinton County
    "39165": "01", // Warren County
    "39167": "02", // Washington County
    "39171": "09", // Williams County
    "39175": "05", // Wyandot County
  },
  FL: {
    "12001": "03", // Alachua County
    "12003": "03", // Baker County
    "12005": "02", // Bay County
    "12007": "03", // Bradford County
    "12009": "08", // Brevard County
    "12013": "02", // Calhoun County
    "12015": "17", // Charlotte County
    "12017": "15", // Citrus County
    "12019": "04", // Clay County
    "12023": "03", // Columbia County
    "12027": "16", // DeSoto County
    "12029": "03", // Dixie County
    "12033": "01", // Escambia County
    "12035": "06", // Flagler County
    "12037": "02", // Franklin County
    "12039": "02", // Gadsden County
    "12041": "03", // Gilchrist County
    "12043": "09", // Glades County
    "12045": "02", // Gulf County
    "12047": "03", // Hamilton County
    "12049": "16", // Hardee County
    "12051": "22", // Hendry County
    "12053": "15", // Hernando County
    "12055": "09", // Highlands County
    "12059": "02", // Holmes County
    "12061": "09", // Indian River County
    "12063": "02", // Jackson County
    "12065": "02", // Jefferson County
    "12073": "02", // Leon County
    "12075": "03", // Levy County
    "12077": "02", // Liberty County
    "12079": "02", // Madison County
    "12081": "16", // Manatee County
    "12085": "21", // Martin County
    "12087": "28", // Monroe County
    "12089": "04", // Nassau County
    "12091": "01", // Okaloosa County
    "12093": "09", // Okeechobee County
    "12107": "06", // Putnam County
    "12111": "21", // St. Lucie County
    "12113": "01", // Santa Rosa County
    "12117": "07", // Seminole County
    "12119": "11", // Sumter County
    "12121": "03", // Suwannee County
    "12123": "02", // Taylor County
    "12125": "03", // Union County
    "12129": "02", // Wakulla County
    "12133": "02", // Washington County
  },
};

// The complement of the table above, state by state: every county in NC,
// MO, OH, and FL that is SPLIT between districts under the new 2026 map,
// so a plain county-level correction can't safely resolve which side of
// the split an address falls on. Listing these explicitly (rather than
// just leaving them unhandled) lets the request below tell "this address
// is in a state we haven't checked at all" apart from "this address is in
// a county we know is split and can't confirm" — the second case should
// tell the user honestly that we don't know, not silently fall through to
// Census's possibly-still-stale answer.
//
// Derived as the set difference between each state's full county list
// (the same authoritative Census reference used to build the table above)
// and that state's whole-county table, so it reconciles exactly to each
// state's known total with zero gaps or double-counting: NC 88+12=100,
// MO 110+5=115, OH 73+15=88, FL 48+19=67.
const STATE_SPLIT_COUNTIES_2026 = {
  NC: new Set([
    "37025", // Cabarrus County
    "37037", // Chatham County
    "37051", // Cumberland County
    "37067", // Forsyth County
    "37077", // Granville County
    "37081", // Guilford County
    "37119", // Mecklenburg County
    "37133", // Onslow County
    "37149", // Polk County
    "37155", // Robeson County
    "37163", // Sampson County
    "37183", // Wake County
  ]),
  MO: new Set([
    "29019", // Boone County
    "29095", // Jackson County
    "29099", // Jefferson County
    "29189", // St. Louis County
    "29225", // Webster County
  ]),
  OH: new Set([
    "39017", // Butler County
    "39023", // Clark County
    "39035", // Cuyahoga County
    "39041", // Delaware County
    "39049", // Franklin County
    "39061", // Hamilton County
    "39075", // Holmes County
    "39099", // Mahoning County
    "39109", // Miami County
    "39127", // Perry County
    "39133", // Portage County
    "39139", // Richland County
    "39151", // Stark County
    "39169", // Wayne County
    "39173", // Wood County
  ]),
  FL: new Set([
    "12011", // Broward County
    "12021", // Collier County
    "12031", // Duval County
    "12057", // Hillsborough County
    "12067", // Lafayette County
    "12069", // Lake County
    "12071", // Lee County
    "12083", // Marion County
    "12086", // Miami-Dade County
    "12095", // Orange County
    "12097", // Osceola County
    "12099", // Palm Beach County
    "12101", // Pasco County
    "12103", // Pinellas County
    "12105", // Polk County
    "12109", // St. Johns County
    "12115", // Sarasota County
    "12127", // Volusia County
    "12131", // Walton County
  ]),
};

// Mutates each addressMatch in place: either corrects its Congressional
// District entry (whole-county case, table above) or tags it with
// ballotWiseRedistrictingUncertain (split-county case, set above) so the
// frontend can tell the user honestly that redistricting has made this
// address unconfirmable rather than silently showing a possibly-wrong
// race. Silently no-ops for every other case — unmapped state, missing
// county data, malformed body — so a Census response shape this doesn't
// expect just passes through unmodified rather than breaking the request.
function applyRedistrictingOverrides(body) {
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    return body;
  }
  const matches = data?.result?.addressMatches;
  if (!Array.isArray(matches)) return body;
  for (const match of matches) {
    const stusab = match.geographies?.States?.[0]?.STUSAB;
    if (!stusab) continue;
    const county = match.geographies?.Counties?.[0];
    if (!county?.STATE || !county?.COUNTY) continue;
    const countyGeoid = `${county.STATE}${county.COUNTY}`;

    const correctDistrict = STATE_COUNTY_DISTRICT_OVERRIDES_2026[stusab]?.[countyGeoid];
    if (correctDistrict) {
      const district = match.geographies?.["119th Congressional Districts"]?.[0];
      if (district) {
        district.CD119 = correctDistrict;
        district.NAME = `Congressional District ${Number(correctDistrict)}`;
        district.GEOID = `${county.STATE}${correctDistrict}`;
        district.BASENAME = String(Number(correctDistrict));
      }
      continue;
    }

    if (STATE_SPLIT_COUNTIES_2026[stusab]?.has(countyGeoid)) {
      match.ballotWiseRedistrictingUncertain = {
        state: stusab,
        countyName: county.NAME || `${county.BASENAME} County`,
      };
    }
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
  return new Response(applyRedistrictingOverrides(result.body), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" },
  });
}
