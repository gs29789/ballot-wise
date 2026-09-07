import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { findCampaignWebsite } from "../sources/webSearchDiscovery.js";

// The free FEC-only pass (scaleCampaignSiteDiscovery.ts) deliberately never
// tries a web search when FEC's own filing has no website -- by design, to
// keep that backlog pass free. But a REAL buildRace() rebuild always falls
// back to findCampaignWebsite() when FEC comes up empty (see build.ts line
// ~557), and that fallback finds real sites FEC's filing simply never had
// -- confirmed directly tonight (Robb Ryerse, AR-3: flagged "no site on
// FEC" by the free pass, found immediately by a real buildRace() rebuild).
// This script runs exactly that same fallback, directly, against the
// no_site_on_fec backlog -- the paid half of the check the free pass
// skipped, now that it's worth running.
const BUILD_ROOT = join(import.meta.dirname, "..", "..", "build");
const NEEDS_REVIEW_PATH = join(import.meta.dirname, "needsHumanReview.json");

function loadReviewFile(): any {
  return JSON.parse(readFileSync(NEEDS_REVIEW_PATH, "utf-8"));
}

async function main() {
  const review = loadReviewFile();
  const targets: any[] = review.no_site_on_fec ?? [];
  console.log(`${targets.length} candidates to check via web search.\n`);

  const fileCache = new Map<string, any>();
  let found = 0;
  let stillNothing = 0;
  const stillEmpty: any[] = [];

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const localPath = join(BUILD_ROOT, t.race);
    let data = fileCache.get(t.race);
    if (!data) {
      if (!existsSync(localPath)) {
        console.log(`[${i + 1}/${targets.length}] ${t.race} -> file missing, skipping`);
        continue;
      }
      data = JSON.parse(readFileSync(localPath, "utf-8"));
      fileCache.set(t.race, data);
    }
    const cand = (data.candidates ?? []).find((c: any) => c.full_name === t.name);
    if (!cand) {
      console.log(`[${i + 1}/${targets.length}] ${t.name} / ${t.race} -> candidate not found in current data, skipping`);
      continue;
    }
    if (cand.campaign_site_url) {
      // Already resolved by something else since this list was built (e.g. a real buildRace() rebuild) -- nothing to do.
      found++;
      console.log(`[${i + 1}/${targets.length}] ${t.name} -> already has a site (${cand.campaign_site_url}), skipping search`);
      continue;
    }

    const office = t.race.startsWith("senate/") ? "S" : "H";
    const state = t.race.split("/")[1].replace(".json", "").split("-")[0];
    const expectedContext = `a candidate for ${office === "H" ? "U.S. House of Representatives" : "U.S. Senate"} from ${state}`;

    const site = await findCampaignWebsite(cand.full_name, expectedContext).catch(() => null);
    if (site) {
      cand.campaign_site_url = site;
      cand._campaign_site_discovered_at = new Date().toISOString();
      found++;
      console.log(`[${i + 1}/${targets.length}] ${t.name} -> FOUND: ${site}`);
      writeFileSync(localPath, JSON.stringify(data, null, 2));
    } else {
      stillNothing++;
      stillEmpty.push(t);
      console.log(`[${i + 1}/${targets.length}] ${t.name} -> still nothing found`);
    }
  }

  review.no_site_on_fec = stillEmpty;
  review.last_updated = new Date().toISOString();
  writeFileSync(NEEDS_REVIEW_PATH, JSON.stringify(review, null, 2));

  console.log(`\nDone. ${targets.length} checked.`);
  console.log(`  Found a real site via web search: ${found}`);
  console.log(`  Still genuinely nothing found:      ${stillNothing}`);
  console.log(`\nRun "npm run publish" to push the updated files to R2.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
