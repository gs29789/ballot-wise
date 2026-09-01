import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { classifySite } from "./scaleCampaignSiteDiscovery.js";

// The web-search fallback (scaleWebSearchSiteDiscovery.ts) sets a real
// campaign_site_url for candidates FEC's own filing had nothing for, but
// never classifies reachability -- that's this script's one job, reusing
// the exact same classifySite() the free FEC-only pass uses. Needed as a
// distinct step because scaleReachableSiteExtraction.ts only picks up
// candidates already marked _campaign_site_reachability === "reachable";
// without this step a freshly-discovered site would sit invisible to
// extraction forever.
const BUILD_ROOT = join(import.meta.dirname, "..", "..", "build");

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (f.endsWith(".json")) out.push(p);
  }
  return out;
}

async function main() {
  const files = walk(BUILD_ROOT);
  let checked = 0;
  const totals: Record<string, number> = { reachable: 0, cloudflare_challenge: 0, blocked_other: 0, dead: 0 };

  for (const f of files) {
    const data = JSON.parse(readFileSync(f, "utf-8"));
    if (!Array.isArray(data.candidates)) continue;
    let changed = false;
    for (const c of data.candidates) {
      if (!c.campaign_site_url || c._campaign_site_reachability) continue;
      const classification = await classifySite(c.campaign_site_url);
      c._campaign_site_reachability = classification;
      totals[classification] = (totals[classification] ?? 0) + 1;
      checked++;
      changed = true;
      console.log(`[${checked}] ${c.full_name} (${c.campaign_site_url}) -> ${classification}`);
    }
    if (changed) writeFileSync(f, JSON.stringify(data, null, 2));
  }

  console.log(`\nDone. ${checked} newly-found sites classified.`);
  console.log(`  Reachable:            ${totals.reachable}`);
  console.log(`  Cloudflare challenge: ${totals.cloudflare_challenge}`);
  console.log(`  Blocked, other:       ${totals.blocked_other}`);
  console.log(`  Dead:                 ${totals.dead}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
