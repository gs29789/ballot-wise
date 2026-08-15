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

// Ten states so far were confirmed to share the same blocker: each enacted
// a genuinely new, legally-in-effect 2026 congressional map, but the Census
// Geocoder's Current_Current vintage still serves the OLD (pre-redraw)
// district boundaries — confirmed directly for each with a real test
// address (e.g. NC's Craven County resolves to the old District 3 instead
// of the new District 1; Tennessee's Millington, actually in District 5
// under the enacted map, still resolves to the old District 9; California's
// Corona, moved out of old CD41 entirely under the new map, still resolves
// to CD41). Missouri, Ohio, Florida, North Carolina, Texas, Alabama,
// Tennessee, and California turned out to have an official, sufficiently
// precise TEXTUAL source (a statute or commission-filed legal description)
// that explicitly distinguishes a county assigned WHOLLY to one district
// from a county SPLIT between districts — for those states, a plain
// county-level correction is exact, not an approximation, for every whole
// county. Texas, Alabama, Tennessee, and California are the strongest
// cases: all four write full census-tract/block-level legal descriptions
// directly into the statute itself (Texas's HB4; Alabama's Act 2023-563,
// whose text incorporates a separate boundary-description PDF by
// reference; Tennessee's SA7001/HA7002 amendment to Tenn. Code Ann.
// § 2-16-103; California's AB 604, which explicitly labels each district's
// counties "Whole" vs. "Partial" and gives block-level text for every
// partial county), not just a county-level breakdown.
//
// Utah is the one exception, sourced differently from every other state
// here: it has no legislative or commission-filed TEXT at all, because its
// map was imposed by a Utah state trial court (not a bill, not a
// commission) and exists only as GIS geometry. Rather than leave it
// unbuilt, Utah's table below was derived by intersecting Census TIGER
// county boundaries against the actual court-sourced district shapefile
// (published by Utah's Geospatial Resource Center, UGRC) with Turf.js, and
// verified against the court's own Findings of Fact ¶143 stating exactly
// which 3 counties are split — the geometric computation reproduced that
// exact 3-county list independently, with a wide (100x+) margin between
// real splits and ordinary cross-dataset boundary-tracing noise. See the
// UT entry itself for the full method note and source URL.
//
// California is a genuinely different SCALE of case worth flagging, not
// just another state on the list: 28 of its 58 counties are split, and
// they're disproportionately the state's most populous ones (Los Angeles
// County alone splits across 18 of the 52 districts) — meaning most
// Californians will still see the "redistricting-uncertain" flag below
// rather than a precise fix, unlike the other 8 states where whole-county
// coverage reached the majority of the population. Shipped this way
// anyway, deliberately: an honest "can't confirm" is still strictly better
// than guessing, the same standard applied everywhere else in this file,
// and California's AB 604 does publish an official block-level
// equivalency file that could resolve the split counties too in a future
// pass — flagged as a real option, not attempted here.
//
// Alabama has a genuinely unusual chronology worth recording: the map
// governing 2026 (Act 2023-563, "Livingston Congressional Plan 3-2023") is
// the ORIGINAL map the legislature passed in 2023 and had enjoined before
// it was ever used — NOT the different, court-drawn remedial map actually
// used in the 2024 election. SCOTUS's May 11, 2026 vacate-and-remand (in
// light of Louisiana v. Callais) and June 2, 2026 stay restored the 2023
// legislative map for 2026 specifically. Confirmed directly in Alabama's
// own 2026 special-session act (HB1's enrolled text): "a federal court...
// permits the reinstatement of the last legislatively enacted Congressional
// districts, as enacted by Act 2023-563 of the 2023 Second Special
// Session, to be used in the 2026 General Election."
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
// independent City of St. Louis, OH 73+15=88, FL 48+19=67, TX 224+30=254,
// AL 61+6=67, TN 83+12=95, CA 30+28=58, UT 26+3=29).
// Counties split between districts are deliberately left OUT of every
// table below — a county-level correction can't safely resolve which side
// of a split county a given address falls on, so those addresses keep
// whatever the (possibly still-stale) Census geocoder returns, same open
// risk as before this fix. One deliberate exception: Texas's Chambers
// County (48071) is technically split in the state's own district-by-
// county report, but with 0 population in District 14 (a near-zero-
// population tract, confirmed against HB4's actual text) and 100% in
// District 36 — every real resident is in 36, so it's included in the
// whole-county table as 36 rather than left uncertain.
//
// Sources (all independently fetched and spot-checked against the actual
// PDF/document text, not just trusted from secondary reporting):
//   NC: N.C. Gen. Stat. § 163-201, https://law.justia.com/codes/north-carolina/chapter-163/article-17/section-163-201/
//   MO: RSMo §§128.471-128.479 (2025 HB1, 2nd Extraordinary Session), https://documents.house.mo.gov/billtracking/bills254/hlrbillspdf/3344H.01T.pdf
//   OH: "Description of Ohio's Congressional District Plan", adopted by the Ohio Redistricting Commission 2025-10-31 — live URL is Cloudflare-gated, use https://web.archive.org/web/20260422123849/https://www.ohiosos.gov/assets/uscongressionaldistricts-2026-2032-adopted-2025-10-31-legaldescription.pdf
//   FL: s. 8.0002, Fla. Stat., as rewritten by HB 1D (2026D Special Session), https://www.flsenate.gov/Session/Bill/2026D/1D/BillText/er/PDF
//   TX: H.B. No. 4, 89th Legislature, 2nd Called Session (2025), enrolled text https://capitol.texas.gov/tlodocs/892/billtext/pdf/HB00004F.pdf — county-by-district populations cross-checked against the Texas Legislative Council's own Red-150 report for the same plan (PLANC2333), https://web.archive.org/web/20250906134058id_/https://data.capitol.texas.gov/dataset/748c952b-e926-4f44-8d01-a738884b3ec8/resource/7a1a23c7-78f4-4587-962e-313350020fdf/download/planc2333_r150.pdf (data.capitol.texas.gov itself is Cloudflare-blocked to automated fetches — same operational gotcha as Ballotpedia, worked around the same way, via Wayback)
//   AL: Act 2023-563 (SB5, 2023 2nd Special Session), codified at §17-14-70, https://alison.legislature.state.al.us/files/pdf/SearchableInstruments/2023SS2/SB5-enr.pdf — incorporates by reference the "Livingston Congressional Plan 3-2023" boundary description, https://www.sos.alabama.gov/sites/default/files/2026-5-14/Livingston%20Congressional%20Plan%203-2023%20Legal%20Description.pdf, independently re-verified directly (not just trusted from the research pass) including the "Russe County" → Russell County resolution below
//   TN: Senate Judiciary 1 Amendment No. 1 to SB7004 ("SA7001"), amending Tenn. Code Ann. § 2-16-103, https://www.capitol.tn.gov/Bills/114/Amend/SA7001.pdf — byte-identical (except sponsor header) to the House's HA7002 substitute for HB7003; capitol.tn.gov is unreachable at the TCP level from this project's sandbox (a harder block than Cloudflare's soft gate elsewhere), fetched via the r.jina.ai reader proxy and independently re-verified directly, including the exact line count (1,992) and opening clause matching the research pass's own quote word-for-word
//   CA: AB 604, Chapter 96, Statutes of 2025 (enacted under Proposition 50, approved by voters 2025-11-04), now Elec. Code §21400 et seq., https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202520260AB604 — explicitly labels "Whole Counties" vs. "Partial Counties" per district; cross-checked against the CA Senate Office of Demographics' consolidated per-district summary tables, https://sdmg.senate.ca.gov/committeehome/2025-congressional-districts, which independently confirmed every whole/split classification used below
//   UT: no legislative text — geometry only. District shapefile: Utah Geospatial Resource Center, "Utah US Congress Districts 2026 to 2032," https://opendata.gis.utah.gov/datasets/utah-us-congress-districts-2026-to-2032/about (live feature service: https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/political_us_congress_districts_2026_to_2032/FeatureServer/0), explicitly described by UGRC as "provided by the Utah Third Judicial District Court" following its Nov 10, 2025 order (Case No. 220901712, Judge Dianna M. Gibson) adopting "Map 1," refined to "Map 1A" after further court-ordered boundary clarifications — last edited on the live service 2026-03-06, i.e. after those clarifications. Cross-checked against the court's own Findings of Fact, ¶143: "Map 1 splits three counties only one time each: Salt Lake, Utah, and Weber counties are split into two districts each," https://statecourtreport.org/sites/default/files/2025-11/salt_lake_county_district_court-findings_of_fact_and_conclusions_of_law.pdf — county boundaries from Census TIGER/Line 2024 (www2.census.gov/geo/tiger/TIGER2024/COUNTY/tl_2024_us_county.zip); classification computed with Turf.js (booleanIntersects + intersect + area), not transcribed
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
  TX: {
    "48001": "05", // Anderson County
    "48003": "19", // Andrews County
    "48005": "36", // Angelina County
    "48009": "13", // Archer County
    "48011": "13", // Armstrong County
    "48013": "28", // Atascosa County
    "48015": "27", // Austin County
    "48017": "19", // Bailey County
    "48019": "21", // Bandera County
    "48023": "13", // Baylor County
    "48025": "15", // Bee County
    "48031": "21", // Blanco County
    "48033": "19", // Borden County
    "48035": "17", // Bosque County
    "48041": "10", // Brazos County
    "48043": "23", // Brewster County
    "48045": "13", // Briscoe County
    "48047": "15", // Brooks County
    "48049": "11", // Brown County
    "48051": "10", // Burleson County
    "48055": "27", // Caldwell County
    "48057": "27", // Calhoun County
    "48061": "34", // Cameron County
    "48063": "32", // Camp County
    "48065": "13", // Carson County
    "48067": "01", // Cass County
    "48069": "19", // Castro County
    "48071": "36", // Chambers County
    "48073": "01", // Cherokee County
    "48075": "13", // Childress County
    "48077": "13", // Clay County
    "48079": "19", // Cochran County
    "48081": "11", // Coke County
    "48083": "11", // Coleman County
    "48087": "13", // Collingsworth County
    "48089": "27", // Colorado County
    "48091": "21", // Comal County
    "48093": "25", // Comanche County
    "48095": "11", // Concho County
    "48097": "26", // Cooke County
    "48099": "31", // Coryell County
    "48101": "13", // Cottle County
    "48103": "23", // Crane County
    "48105": "23", // Crockett County
    "48107": "19", // Crosby County
    "48109": "23", // Culberson County
    "48111": "13", // Dallam County
    "48115": "19", // Dawson County
    "48117": "13", // Deaf Smith County
    "48119": "03", // Delta County
    "48123": "15", // DeWitt County
    "48125": "13", // Dickens County
    "48127": "28", // Dimmit County
    "48129": "13", // Donley County
    "48131": "28", // Duval County
    "48133": "25", // Eastland County
    "48135": "11", // Ector County
    "48137": "23", // Edwards County
    "48139": "06", // Ellis County
    "48143": "25", // Erath County
    "48145": "17", // Falls County
    "48147": "04", // Fannin County
    "48149": "27", // Fayette County
    "48151": "19", // Fisher County
    "48153": "19", // Floyd County
    "48155": "13", // Foard County
    "48159": "03", // Franklin County
    "48161": "17", // Freestone County
    "48163": "23", // Frio County
    "48165": "19", // Gaines County
    "48167": "14", // Galveston County
    "48169": "19", // Garza County
    "48171": "21", // Gillespie County
    "48173": "11", // Glasscock County
    "48175": "15", // Goliad County
    "48177": "15", // Gonzales County
    "48179": "13", // Gray County
    "48181": "04", // Grayson County
    "48183": "01", // Gregg County
    "48185": "10", // Grimes County
    "48187": "35", // Guadalupe County
    "48189": "19", // Hale County
    "48191": "13", // Hall County
    "48193": "31", // Hamilton County
    "48195": "13", // Hansford County
    "48197": "13", // Hardeman County
    "48199": "36", // Hardin County
    "48203": "01", // Harrison County
    "48205": "13", // Hartley County
    "48207": "19", // Haskell County
    "48211": "13", // Hemphill County
    "48213": "05", // Henderson County
    "48217": "17", // Hill County
    "48219": "19", // Hockley County
    "48221": "25", // Hood County
    "48223": "03", // Hopkins County
    "48225": "10", // Houston County
    "48227": "19", // Howard County
    "48229": "23", // Hudspeth County
    "48233": "13", // Hutchinson County
    "48235": "11", // Irion County
    "48237": "25", // Jack County
    "48239": "27", // Jackson County
    "48241": "36", // Jasper County
    "48243": "23", // Jeff Davis County
    "48247": "28", // Jim Hogg County
    "48249": "15", // Jim Wells County
    "48253": "19", // Jones County
    "48255": "35", // Karnes County
    "48257": "05", // Kaufman County
    "48259": "21", // Kendall County
    "48261": "34", // Kenedy County
    "48263": "19", // Kent County
    "48265": "21", // Kerr County
    "48267": "11", // Kimble County
    "48269": "13", // King County
    "48271": "23", // Kinney County
    "48273": "34", // Kleberg County
    "48275": "13", // Knox County
    "48277": "04", // Lamar County
    "48279": "19", // Lamb County
    "48281": "31", // Lampasas County
    "48283": "28", // La Salle County
    "48285": "15", // Lavaca County
    "48287": "10", // Lee County
    "48289": "10", // Leon County
    "48291": "09", // Liberty County
    "48293": "17", // Limestone County
    "48295": "13", // Lipscomb County
    "48297": "28", // Live Oak County
    "48299": "11", // Llano County
    "48301": "23", // Loving County
    "48303": "19", // Lubbock County
    "48305": "19", // Lynn County
    "48307": "11", // McCulloch County
    "48309": "17", // McLennan County
    "48311": "28", // McMullen County
    "48313": "10", // Madison County
    "48315": "01", // Marion County
    "48317": "19", // Martin County
    "48319": "11", // Mason County
    "48321": "27", // Matagorda County
    "48325": "23", // Medina County
    "48327": "11", // Menard County
    "48329": "11", // Midland County
    "48331": "17", // Milam County
    "48333": "31", // Mills County
    "48335": "19", // Mitchell County
    "48337": "13", // Montague County
    "48341": "13", // Moore County
    "48343": "03", // Morris County
    "48345": "13", // Motley County
    "48347": "01", // Nacogdoches County
    "48349": "06", // Navarro County
    "48351": "36", // Newton County
    "48353": "19", // Nolan County
    "48357": "13", // Ochiltree County
    "48359": "13", // Oldham County
    "48361": "14", // Orange County
    "48363": "25", // Palo Pinto County
    "48365": "01", // Panola County
    "48369": "19", // Parmer County
    "48371": "23", // Pecos County
    "48373": "10", // Polk County
    "48375": "13", // Potter County
    "48377": "23", // Presidio County
    "48379": "32", // Rains County
    "48381": "13", // Randall County
    "48383": "23", // Reagan County
    "48385": "21", // Real County
    "48387": "04", // Red River County
    "48389": "23", // Reeves County
    "48393": "13", // Roberts County
    "48395": "17", // Robertson County
    "48397": "32", // Rockwall County
    "48399": "11", // Runnels County
    "48401": "01", // Rusk County
    "48403": "01", // Sabine County
    "48405": "01", // San Augustine County
    "48407": "10", // San Jacinto County
    "48411": "11", // San Saba County
    "48413": "23", // Schleicher County
    "48415": "19", // Scurry County
    "48417": "19", // Shackelford County
    "48419": "01", // Shelby County
    "48421": "13", // Sherman County
    "48423": "01", // Smith County
    "48425": "25", // Somervell County
    "48427": "28", // Starr County
    "48429": "25", // Stephens County
    "48431": "11", // Sterling County
    "48433": "19", // Stonewall County
    "48435": "23", // Sutton County
    "48437": "19", // Swisher County
    "48441": "19", // Taylor County
    "48443": "23", // Terrell County
    "48445": "19", // Terry County
    "48447": "19", // Throckmorton County
    "48449": "03", // Titus County
    "48451": "11", // Tom Green County
    "48455": "10", // Trinity County
    "48457": "36", // Tyler County
    "48459": "32", // Upshur County
    "48461": "23", // Upton County
    "48463": "23", // Uvalde County
    "48465": "23", // Val Verde County
    "48467": "05", // Van Zandt County
    "48469": "27", // Victoria County
    "48473": "08", // Waller County
    "48475": "23", // Ward County
    "48477": "27", // Washington County
    "48479": "28", // Webb County
    "48481": "27", // Wharton County
    "48483": "13", // Wheeler County
    "48485": "13", // Wichita County
    "48487": "13", // Wilbarger County
    "48489": "34", // Willacy County
    "48493": "35", // Wilson County
    "48495": "23", // Winkler County
    "48499": "32", // Wood County
    "48501": "19", // Yoakum County
    "48503": "25", // Young County
    "48505": "28", // Zapata County
    "48507": "23", // Zavala County
  },
  AL: {
    "01003": "01", // Baldwin County
    "01039": "01", // Covington County
    "01053": "01", // Escambia County
    "01005": "02", // Barbour County
    "01011": "02", // Bullock County
    "01013": "02", // Butler County
    "01031": "02", // Coffee County
    "01041": "02", // Crenshaw County
    "01045": "02", // Dale County
    "01061": "02", // Geneva County
    "01067": "02", // Henry County
    "01069": "02", // Houston County
    "01085": "02", // Lowndes County
    "01087": "02", // Macon County
    "01101": "02", // Montgomery County
    "01109": "02", // Pike County
    "01113": "02", // Russell County (source PDF misprints as "Russe County" — confirmed no "Russell" appears anywhere else in the document and "Russe" isn't a real Alabama county; Census GEOID 01113 is genuinely Russell County)
    "01015": "03", // Calhoun County
    "01017": "03", // Chambers County
    "01019": "03", // Cherokee County
    "01027": "03", // Clay County
    "01029": "03", // Cleburne County
    "01055": "03", // Etowah County
    "01081": "03", // Lee County
    "01111": "03", // Randolph County
    "01115": "03", // St. Clair County
    "01123": "03", // Tallapoosa County
    "01009": "04", // Blount County
    "01033": "04", // Colbert County
    "01043": "04", // Cullman County
    "01049": "04", // DeKalb County
    "01057": "04", // Fayette County
    "01059": "04", // Franklin County
    "01075": "04", // Lamar County
    "01093": "04", // Marion County
    "01095": "04", // Marshall County
    "01127": "04", // Walker County
    "01133": "04", // Winston County
    "01071": "05", // Jackson County
    "01079": "05", // Lawrence County
    "01083": "05", // Limestone County
    "01089": "05", // Madison County
    "01103": "05", // Morgan County
    "01001": "06", // Autauga County
    "01007": "06", // Bibb County
    "01021": "06", // Chilton County
    "01037": "06", // Coosa County
    "01117": "06", // Shelby County
    "01023": "07", // Choctaw County
    "01025": "07", // Clarke County
    "01035": "07", // Conecuh County
    "01047": "07", // Dallas County
    "01063": "07", // Greene County
    "01065": "07", // Hale County
    "01091": "07", // Marengo County
    "01099": "07", // Monroe County
    "01105": "07", // Perry County
    "01107": "07", // Pickens County
    "01119": "07", // Sumter County
    "01129": "07", // Washington County
    "01131": "07", // Wilcox County
  },
  TN: {
    "47001": "03", // Anderson County
    "47003": "09", // Bedford County
    "47005": "05", // Benton County
    "47007": "04", // Bledsoe County
    "47009": "02", // Blount County
    "47011": "03", // Bradley County
    "47015": "04", // Cannon County
    "47017": "08", // Carroll County
    "47019": "01", // Carter County
    "47021": "07", // Cheatham County
    "47023": "08", // Chester County
    "47025": "02", // Claiborne County
    "47027": "06", // Clay County
    "47029": "01", // Cocke County
    "47031": "04", // Coffee County
    "47033": "08", // Crockett County
    "47035": "06", // Cumberland County
    "47039": "08", // Decatur County
    "47041": "06", // DeKalb County
    "47043": "07", // Dickson County
    "47045": "05", // Dyer County
    "47049": "06", // Fentress County
    "47051": "04", // Franklin County
    "47053": "08", // Gibson County
    "47055": "09", // Giles County
    "47057": "02", // Grainger County
    "47059": "01", // Greene County
    "47061": "04", // Grundy County
    "47063": "01", // Hamblen County
    "47065": "03", // Hamilton County
    "47067": "01", // Hancock County
    "47069": "09", // Hardeman County
    "47071": "09", // Hardin County
    "47073": "01", // Hawkins County
    "47075": "08", // Haywood County
    "47077": "08", // Henderson County
    "47079": "05", // Henry County
    "47081": "05", // Hickman County
    "47083": "05", // Houston County
    "47085": "05", // Humphreys County
    "47087": "06", // Jackson County
    "47091": "01", // Johnson County
    "47093": "02", // Knox County
    "47095": "05", // Lake County
    "47097": "05", // Lauderdale County
    "47099": "09", // Lawrence County
    "47101": "05", // Lewis County
    "47103": "09", // Lincoln County
    "47105": "02", // Loudon County
    "47107": "03", // McMinn County
    "47109": "09", // McNairy County
    "47111": "07", // Macon County
    "47113": "08", // Madison County
    "47115": "04", // Marion County
    "47117": "09", // Marshall County
    "47121": "03", // Meigs County
    "47123": "03", // Monroe County
    "47127": "09", // Moore County
    "47129": "06", // Morgan County
    "47131": "05", // Obion County
    "47133": "06", // Overton County
    "47135": "08", // Perry County
    "47137": "06", // Pickett County
    "47139": "03", // Polk County
    "47141": "06", // Putnam County
    "47145": "03", // Roane County
    "47147": "07", // Robertson County
    "47151": "06", // Scott County
    "47153": "04", // Sequatchie County
    "47155": "01", // Sevier County
    "47159": "06", // Smith County
    "47161": "05", // Stewart County
    "47163": "01", // Sullivan County
    "47169": "07", // Trousdale County
    "47171": "01", // Unicoi County
    "47173": "02", // Union County
    "47175": "04", // Van Buren County
    "47177": "04", // Warren County
    "47179": "01", // Washington County
    "47181": "09", // Wayne County
    "47183": "05", // Weakley County
    "47185": "06", // White County
    "47189": "06", // Wilson County
  },
  CA: {
    "06003": "05", // Alpine County
    "06005": "05", // Amador County
    "06007": "01", // Butte County
    "06009": "05", // Calaveras County
    "06011": "03", // Colusa County
    "06015": "02", // Del Norte County
    "06021": "01", // Glenn County
    "06023": "02", // Humboldt County
    "06025": "25", // Imperial County
    "06027": "05", // Inyo County
    "06035": "01", // Lassen County
    "06041": "02", // Marin County
    "06043": "05", // Mariposa County
    "06047": "13", // Merced County
    "06049": "02", // Modoc County
    "06051": "05", // Mono County
    "06055": "04", // Napa County
    "06057": "03", // Nevada County
    "06063": "01", // Plumas County
    "06069": "18", // San Benito County
    "06083": "24", // Santa Barbara County
    "06089": "02", // Shasta County
    "06091": "01", // Sierra County
    "06093": "02", // Siskiyou County
    "06095": "08", // Solano County
    "06101": "04", // Sutter County
    "06103": "01", // Tehama County
    "06105": "02", // Trinity County
    "06109": "05", // Tuolumne County
    "06115": "04", // Yuba County
  },
  // Utah has no legislative or commission-filed TEXT describing its 2026
  // map at all — it was imposed by a Utah state trial court (Third
  // Judicial District Court, Salt Lake County, Case No. 220901712, Nov 10
  // 2025) and codified only as GIS geometry, not county-name prose, unlike
  // every other state in this table. So this table is derived differently
  // from the rest: computed by intersecting Census TIGER county boundaries
  // against the court-sourced district shapefile published by Utah's
  // Geospatial Resource Center (UGRC, operated jointly with the Lt.
  // Governor's elections office) — https://opendata.gis.utah.gov/datasets/utah-us-congress-districts-2026-to-2032
  // — rather than transcribed from statute text. Verified against the
  // court's own Findings of Fact ¶143 ("Map 1 splits three counties only
  // one time each: Salt Lake, Utah, and Weber"): the geometric computation
  // reproduces exactly this same 3-county split, with every other overlap
  // between a "whole" county and a neighboring district under 0.02% of
  // that county's area — three orders of magnitude below the smallest real
  // split (Weber, 1.6%) — consistent with ordinary boundary-tracing
  // misalignment between two independently-drawn datasets, not a real
  // split. 26 whole + 3 split = 29, zero gaps/dupes, same reconciliation
  // standard as every other state here.
  UT: {
    "49001": "03", // Beaver County
    "49003": "02", // Box Elder County
    "49005": "02", // Cache County
    "49007": "03", // Carbon County
    "49009": "03", // Daggett County
    "49011": "02", // Davis County
    "49013": "03", // Duchesne County
    "49015": "03", // Emery County
    "49017": "03", // Garfield County
    "49019": "03", // Grand County
    "49021": "03", // Iron County
    "49023": "04", // Juab County
    "49025": "03", // Kane County
    "49027": "04", // Millard County
    "49029": "03", // Morgan County
    "49031": "03", // Piute County
    "49033": "02", // Rich County
    "49037": "03", // San Juan County
    "49039": "04", // Sanpete County
    "49041": "04", // Sevier County
    "49043": "03", // Summit County
    "49045": "04", // Tooele County
    "49047": "03", // Uintah County
    "49051": "03", // Wasatch County
    "49053": "03", // Washington County
    "49055": "03", // Wayne County
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
  TX: new Set([
    "48007", // Aransas County
    "48021", // Bastrop County
    "48027", // Bell County
    "48029", // Bexar County
    "48037", // Bowie County
    "48039", // Brazoria County
    "48053", // Burnet County
    "48059", // Callahan County
    "48085", // Collin County
    "48113", // Dallas County
    "48121", // Denton County
    "48141", // El Paso County
    "48157", // Fort Bend County
    "48201", // Harris County
    "48209", // Hays County
    "48215", // Hidalgo County
    "48231", // Hunt County
    "48245", // Jefferson County
    "48251", // Johnson County
    "48323", // Maverick County
    "48339", // Montgomery County
    "48355", // Nueces County
    "48367", // Parker County
    "48391", // Refugio County
    "48409", // San Patricio County
    "48439", // Tarrant County
    "48453", // Travis County
    "48471", // Walker County
    "48491", // Williamson County
    "48497", // Wise County
  ]),
  AL: new Set([
    "01097", // Mobile County
    "01051", // Elmore County
    "01073", // Jefferson County
    "01077", // Lauderdale County
    "01121", // Talladega County
    "01125", // Tuscaloosa County
  ]),
  CA: new Set([
    "06001", // Alameda County
    "06013", // Contra Costa County
    "06017", // El Dorado County
    "06019", // Fresno County
    "06029", // Kern County
    "06031", // Kings County
    "06033", // Lake County
    "06037", // Los Angeles County
    "06039", // Madera County
    "06045", // Mendocino County
    "06053", // Monterey County
    "06059", // Orange County
    "06061", // Placer County
    "06065", // Riverside County
    "06067", // Sacramento County
    "06071", // San Bernardino County
    "06073", // San Diego County
    "06075", // San Francisco County
    "06077", // San Joaquin County
    "06079", // San Luis Obispo County
    "06081", // San Mateo County
    "06085", // Santa Clara County
    "06087", // Santa Cruz County
    "06097", // Sonoma County
    "06099", // Stanislaus County
    "06107", // Tulare County
    "06111", // Ventura County
    "06113", // Yolo County
  ]),
  UT: new Set([
    "49035", // Salt Lake County — District 1 76.9% / District 4 23.1%
    "49049", // Utah County — District 3 60.2% / District 4 39.8%
    "49057", // Weber County — District 2 98.4% / District 3 1.6%
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
