const CONGRESS_BASE = "https://api.congress.gov/v3";

export interface MemberInfo {
  bioguideId: string;
  name: string;
  party: string;
  imageUrl: string | null;
}

function apiKey(): string {
  const key = process.env.CONGRESS_GOV_API_KEY;
  if (!key) throw new Error("CONGRESS_GOV_API_KEY not set");
  return key;
}

export async function getMembersByState(stateCode: string): Promise<MemberInfo[]> {
  const url = `${CONGRESS_BASE}/member/${stateCode}?api_key=${apiKey()}&format=json`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.members as any[]).map((m) => ({
    bioguideId: m.bioguideId,
    name: m.name,
    party: m.partyName ?? "",
    imageUrl: m.depiction?.imageUrl ?? null,
  }));
}

export async function getMember(bioguideId: string): Promise<MemberInfo | null> {
  const url = `${CONGRESS_BASE}/member/${bioguideId}?api_key=${apiKey()}&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const m = data.member;
  return {
    bioguideId: m.bioguideId,
    name: m.directOrderName ?? m.invertedOrderName,
    party: m.partyHistory?.[0]?.partyName ?? "",
    imageUrl: m.depiction?.imageUrl ?? null,
  };
}

export interface LegislativeActivity {
  billsSponsored: number;
  billsCosponsored: number;
}

export async function getLegislativeActivity(bioguideId: string): Promise<LegislativeActivity | null> {
  const url = `${CONGRESS_BASE}/member/${bioguideId}?api_key=${apiKey()}&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const m = data.member;
  return {
    billsSponsored: m.sponsoredLegislation?.count ?? 0,
    billsCosponsored: m.cosponsoredLegislation?.count ?? 0,
  };
}

// Congress.gov's REST API does not expose per-member roll-call vote positions
// (yes/no on a specific bill). That requires parsing the House Clerk's
// roll-call XML (clerk.house.gov/evs) or the Senate's (senate.gov/legislative/LIS)
// directly — not implemented here yet, tracked as a follow-up source module.
export function rollCallVotesNotice(): string {
  return "Roll-call vote positions require parsing House/Senate XML feeds, not the Congress.gov REST API. See handoff doc.";
}
