const CONGRESS_BASE = "https://api.congress.gov/v3";

export interface MemberInfo {
  bioguideId: string;
  name: string;
  party: string;
  imageUrl: string | null;
  officialWebsiteUrl?: string | null;
}

function apiKey(): string {
  const key = process.env.CONGRESS_GOV_API_KEY;
  if (!key) throw new Error("CONGRESS_GOV_API_KEY not set");
  return key;
}

// This endpoint returns EVERY member ever recorded for the state (all
// historical Congresses), not just the current one, and defaults to a
// 20-result page with no warning that more exist. Confirmed as a real,
// previously-invisible bug: Florida alone has 131 total members, and a
// single unpaginated call silently dropped Ashley Moody (a 2025 Senate
// appointee) since she wasn't in the first 20 -- her `bioguideId` came
// back null, which cascades into every congress.gov-sourced stat (votes,
// attendance, committees, ideology score) silently showing nothing for a
// genuinely sitting Senator. Paginated fully (not just bumped to a larger
// fixed limit) since an older/more populous state's historical member
// count could exceed any fixed page size.
export async function getMembersByState(stateCode: string): Promise<MemberInfo[]> {
  const members: MemberInfo[] = [];
  let url: string | null = `${CONGRESS_BASE}/member/${stateCode}?api_key=${apiKey()}&format=json&limit=250`;
  while (url) {
    const res = await fetch(url);
    if (!res.ok) break;
    const data = await res.json();
    for (const m of data.members as any[]) {
      members.push({ bioguideId: m.bioguideId, name: m.name, party: m.partyName ?? "", imageUrl: m.depiction?.imageUrl ?? null });
    }
    const next = data.pagination?.next as string | undefined;
    url = next ? `${next}&api_key=${apiKey()}` : null;
  }
  return members;
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
    officialWebsiteUrl: m.officialWebsiteUrl ?? null,
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

export interface EnactedLaw {
  title: string;
  congress: number;
  billType: string;
  billNumber: string;
  publicLawNumber: string; // e.g. "119-76"
  summary: string | null; // plain-English CRS summary, HTML stripped
  govinfoUrl: string; // permanent link to the official enrolled law text
}

// Congress.gov's sponsored-legislation list includes each bill's latest
// action text in the same paginated response — no per-bill lookup needed to
// find which ones became law. "Became Public Law No: 119-76." is how the
// API phrases enactment; the law number lets us link straight to the
// authoritative text on GovInfo without a separate GovInfo API call — the
// package ID (PLAW-{congress}publ{number}) is a fixed, predictable pattern.
export async function getEnactedLaws(bioguideId: string): Promise<EnactedLaw[]> {
  let url: string | null = `${CONGRESS_BASE}/member/${bioguideId}/sponsored-legislation?api_key=${apiKey()}&format=json&limit=250`;
  const enacted: Array<{ title: string; congress: number; billType: string; billNumber: string; publicLawNumber: string }> = [];

  while (url) {
    const res = await fetch(url);
    if (!res.ok) break;
    const data = await res.json();
    for (const bill of data.sponsoredLegislation ?? []) {
      const match = (bill.latestAction?.text ?? "").match(/Became Public Law No:\s*(\d+-\d+)/);
      if (match) {
        enacted.push({
          title: bill.title,
          congress: bill.congress,
          billType: bill.type,
          billNumber: bill.number,
          publicLawNumber: match[1],
        });
      }
    }
    url = data.pagination?.next ? `${data.pagination.next}&api_key=${apiKey()}` : null;
  }

  return Promise.all(
    enacted.map(async (law) => {
      const [, lawNum] = law.publicLawNumber.split("-");
      const summary = await getBillSummary(law.congress, law.billType, law.billNumber).catch(() => null);
      return {
        ...law,
        summary,
        govinfoUrl: `https://www.govinfo.gov/app/details/PLAW-${law.congress}publ${lawNum}`,
      };
    })
  );
}

async function getBillSummary(congress: number, billType: string, billNumber: string): Promise<string | null> {
  const url = `${CONGRESS_BASE}/bill/${congress}/${billType.toLowerCase()}/${billNumber}/summaries?api_key=${apiKey()}&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const summaries = data.summaries ?? [];
  if (!summaries.length) return null;
  // Prefer the summary written at enactment ("Public Law") over earlier
  // versions (introduced/passed), since the bill can change before signing.
  const best = summaries.find((s: any) => s.actionDesc === "Public Law") ?? summaries[summaries.length - 1];
  return best.text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Congress.gov's REST API does not expose per-member roll-call vote positions
// (yes/no on a specific bill). That requires parsing the House Clerk's
// roll-call XML (clerk.house.gov/evs) or the Senate's (senate.gov/legislative/LIS)
// directly — not implemented here yet, tracked as a follow-up source module.
export function rollCallVotesNotice(): string {
  return "Roll-call vote positions require parsing House/Senate XML feeds, not the Congress.gov REST API. See handoff doc.";
}
