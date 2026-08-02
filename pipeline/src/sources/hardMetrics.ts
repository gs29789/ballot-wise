// District/state-level context metrics — presented alongside an officeholder's
// tenure, not attributed to them causally. State-level only for now, which is
// exactly right for Delaware (one at-large House seat + statewide Senate) but
// will need a state->district crosswalk once this scales to multi-district states.

const STATE_FIPS: Record<string, string> = { DE: "10" }; // extend as new states are added

export interface UnemploymentPoint {
  year: string;
  month: string;
  value: number;
}

// BLS public API — no key required at this query volume (25 requests/day cap).
export async function getUnemploymentRate(stateCode: string, startYear: number, endYear: number): Promise<UnemploymentPoint[] | null> {
  const fips = STATE_FIPS[stateCode];
  if (!fips) return null;
  const seriesId = `LASST${fips}0000000000003`;
  const url = `https://api.bls.gov/publicAPI/v2/timeseries/data/${seriesId}?startyear=${startYear}&endyear=${endYear}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const series = data.Results?.series?.[0]?.data ?? [];
  return series.map((d: any) => ({ year: d.year, month: d.periodName, value: Number(d.value) }));
}

export interface CrimeRatePoint {
  year: string;
  ratePer100k: number;
}

// FBI Crime Data Explorer — same api.data.gov key as FEC/Congress.gov.
export async function getViolentCrimeRate(stateCode: string, fromYear: number, toYear: number): Promise<CrimeRatePoint[] | null> {
  const key = process.env.FEC_API_KEY; // api.data.gov issues one key across participating APIs
  if (!key) return null;
  const url = `https://api.usa.gov/crime/fbi/cde/summarized/state/${stateCode}/violent-crime?type=rates&from=01-${fromYear}&to=12-${toYear}&API_KEY=${key}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const rates: Record<string, number> = Object.values(data.offenses?.rates ?? {})[0] as any ?? {};
  // Collapse monthly rates to one point per year (last available month that year).
  const byYear = new Map<string, number>();
  for (const [monthYear, rate] of Object.entries(rates)) {
    const [, year] = monthYear.split("-");
    byYear.set(year, rate as number);
  }
  return [...byYear.entries()].map(([year, ratePer100k]) => ({ year, ratePer100k })).sort((a, b) => a.year.localeCompare(b.year));
}
