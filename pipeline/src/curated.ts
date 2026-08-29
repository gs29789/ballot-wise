import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

export interface SourcedField<T> {
  value: T;
  source_url: string;
  snippet: string;
  verified_by?: string;
  verified_at?: string;
}

export interface CuratedBioSummary {
  value: string;
  source_url: string;
  source_type: "campaign_site" | "wikipedia" | "ballotpedia" | "curated";
}

export interface CuratedPlatformVideo {
  video_url: string;
  video_title: string;
  source_url: string;
  source_type: "campaign_site" | "youtube_search" | "wikipedia" | "curated";
}

export interface CuratedCandidate {
  fec_candidate_id?: string;
  bioguide_id?: string | null;
  bio?: Record<string, SourcedField<unknown>>;
  // Both fields below are checked BEFORE any automated resolution and, when
  // present, used as-is -- never re-fetched, never re-derived, never at risk
  // of a later rebuild silently reverting them. This is the stabilization
  // mechanism itself: curated data lives in git-tracked source on `main`,
  // not in the separate data-snapshot branch a targeted publish can leave
  // stale. See build.ts's bio_summary/video resolution for how this is
  // wired in, and pipeline/curated/SC/senate/james-clyburn.yaml for why
  // this exists at all -- a hand-verified video silently vanished once
  // already because nothing protected it from a later full rebuild.
  bio_summary?: CuratedBioSummary;
  platform_video?: CuratedPlatformVideo;
}

const CURATED_ROOT = join(import.meta.dirname, "..", "curated");

export function loadCuratedRace(state: string, raceSlug: string): Record<string, CuratedCandidate> {
  const dir = join(CURATED_ROOT, state, raceSlug);
  if (!existsSync(dir)) return {};
  const out: Record<string, CuratedCandidate> = {};
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".yaml")) continue;
    const slug = file.replace(/\.yaml$/, "");
    out[slug] = yaml.load(readFileSync(join(dir, file), "utf8")) as CuratedCandidate;
  }
  return out;
}
