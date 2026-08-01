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

export interface CuratedCandidate {
  fec_candidate_id?: string;
  bioguide_id?: string | null;
  bio?: Record<string, SourcedField<unknown>>;
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
