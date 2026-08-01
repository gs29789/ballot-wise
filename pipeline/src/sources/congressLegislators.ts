import yaml from "js-yaml";

const RAW_BASE = "https://raw.githubusercontent.com/unitedstates/congress-legislators/main";

let committeeMembershipCache: Record<string, any[]> | null = null;
let committeeNameCache: Record<string, string> | null = null;

async function loadCommitteeMembership(): Promise<Record<string, any[]>> {
  if (committeeMembershipCache) return committeeMembershipCache;
  const res = await fetch(`${RAW_BASE}/committee-membership-current.yaml`);
  committeeMembershipCache = yaml.load(await res.text()) as Record<string, any[]>;
  return committeeMembershipCache;
}

async function loadCommitteeNames(): Promise<Record<string, string>> {
  if (committeeNameCache) return committeeNameCache;
  const res = await fetch(`${RAW_BASE}/committees-current.yaml`);
  const committees = yaml.load(await res.text()) as any[];
  const names: Record<string, string> = {};
  for (const c of committees) {
    if (c.thomas_id) names[c.thomas_id] = c.name;
    for (const sub of c.subcommittees ?? []) {
      names[c.thomas_id + sub.thomas_id] = `${c.name} — ${sub.name}`;
    }
  }
  committeeNameCache = names;
  return names;
}

export interface CommitteeAssignment {
  committee: string;
  title: string;
  sourceUrl: string;
}

// Congress.gov's REST API does not expose committee membership. This is
// sourced from unitedstates/congress-legislators, the open-data project
// GovTrack and ProPublica build on — public, no key, CORS-enabled.
export async function getCommitteeAssignments(bioguideId: string): Promise<CommitteeAssignment[]> {
  const [membership, names] = await Promise.all([loadCommitteeMembership(), loadCommitteeNames()]);
  const out: CommitteeAssignment[] = [];
  for (const [committeeId, members] of Object.entries(membership)) {
    const mine = members.find((m: any) => m.bioguide === bioguideId);
    if (mine) {
      out.push({
        committee: names[committeeId] ?? committeeId,
        title: mine.title ?? "Member",
        sourceUrl: `${RAW_BASE}/committee-membership-current.yaml`,
      });
    }
  }
  return out;
}
