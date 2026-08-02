import React, { useState } from "react";
import { Search, MapPin, Info, CheckCircle2, AlertTriangle, ExternalLink, ArrowLeft, ChevronRight } from "lucide-react";

const T = {
  paper: "#F4F1E9", paperRaised: "#FBFAF6", ink: "#211D18", inkSoft: "#6B6255",
  line: "#DAD2BF", gold: "#8C6D1F", rep: "#A83A2D", repSoft: "#F3E1DC",
  dem: "#28587E", demSoft: "#DEE8EF", ind: "#B36A00", indSoft: "#F6E3C8",
  success: "#3C7A54", successSoft: "#DFEBE2", warn: "#8C6D1F", warnSoft: "#F1E9D4",
};

const DATA_BASE = import.meta.env.VITE_DATA_BASE_URL || "";

function partyCode(fecPartyFull) {
  if (/republican/i.test(fecPartyFull)) return "R";
  if (/democrat/i.test(fecPartyFull)) return "D";
  return "I";
}
const partyColor = (p) => (p === "R" ? T.rep : p === "D" ? T.dem : T.ind);
const partySoft = (p) => (p === "R" ? T.repSoft : p === "D" ? T.demSoft : T.indSoft);
const partyName = (p) => (p === "R" ? "Republican" : p === "D" ? "Democrat" : "Independent");
const cols = (n) => `180px repeat(${n}, 1fr)`;
const fmtMoney = (n) => (n === null || n === undefined ? null : `$${Math.round(n).toLocaleString("en-US")}`);

function toTitleCase(fecName) {
  // FEC names come as "LAST, FIRST MIDDLE" — flip to a readable display name.
  const [last, rest] = fecName.split(",").map((s) => s.trim());
  const cap = (s) => s.split(/\s+/).map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
  return rest ? `${cap(rest)} ${cap(last)}` : cap(last);
}

// Census Geocoder has no CORS headers, so it's proxied through a same-origin
// Cloudflare Pages Function (functions/api/geocode.js) rather than called
// directly. Resolves a street address to its congressional district;
// CD119 "00" means at-large.
async function geocodeAddress(address) {
  const url = `/api/geocode?address=${encodeURIComponent(address)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Address lookup failed.");
  const data = await res.json();
  const match = data.result?.addressMatches?.[0];
  if (!match) throw new Error("Couldn't resolve that address to a district. Check the spelling and try again.");

  const state = match.geographies?.States?.[0];
  const district = match.geographies?.["119th Congressional Districts"]?.[0];
  if (!state || !district) throw new Error("Census data didn't include a congressional district for that address.");

  const cd = district.CD119;
  return {
    stusab: state.STUSAB,
    stateName: state.BASENAME,
    districtCode: cd === "00" ? "AL" : String(Number(cd)),
    districtLabel: cd === "00" ? "At-Large" : `District ${Number(cd)}`,
  };
}

async function fetchRace(chamber, stusab, districtCode) {
  const path = chamber === "house" ? `house/${stusab}-${districtCode}.json` : `senate/${stusab}.json`;
  const res = await fetch(`${DATA_BASE}/${path}`);
  if (res.status === 404) return null; // no built race for this district yet — not an error, just not covered
  if (!res.ok) throw new Error(`Couldn't load candidate data (${res.status}).`);
  return res.json();
}

function truncateText(text, maxLen) {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  return cut.slice(0, cut.lastIndexOf(" ")) + "…";
}

// maxLen truncates long prose (employment history, civic affiliations) for
// the comparison grid — full text belongs on the candidate's profile page,
// not crammed into a scanning view. Short facts (DOB, college) pass maxLen
// unset and render in full either place.
function SourcedField({ field, label, emptyText = "No public record found", maxLen }) {
  if (!field) return <span style={{ color: T.inkSoft, fontStyle: "italic" }}>{emptyText}</span>;
  const displayValue = maxLen ? truncateText(field.value, maxLen) : field.value;
  return (
    <span>
      {displayValue}{" "}
      {field.source_url && (
        <a href={field.source_url} target="_blank" rel="noreferrer" style={{ color: T.gold, marginLeft: 4 }} title={field.snippet || label}>
          <ExternalLink size={11} style={{ verticalAlign: "middle" }} />
        </a>
      )}
    </span>
  );
}

function Legend() {
  const items = [["R", "Republican"], ["D", "Democrat"], ["I", "Independent"]];
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      {items.map(([p, label]) => (
        <div key={p} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.inkSoft }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: partyColor(p) }} />
          {label}
        </div>
      ))}
    </div>
  );
}

function CandidateTab({ c, onOpenProfile }) {
  const party = partyCode(c.party);
  return (
    <div style={{ background: partySoft(party), borderTop: `4px solid ${partyColor(party)}`, borderRadius: "6px 6px 0 0", padding: "16px 14px 12px" }}>
      <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: partyColor(party), fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>
        {partyName(party)}{c.incumbent ? " · Incumbent" : ""}
      </div>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600, color: T.ink, marginTop: 2, lineHeight: 1.2 }}>
        {toTitleCase(c.full_name)}
      </div>
      <button
        onClick={() => onOpenProfile(c.slug)}
        style={{ display: "flex", alignItems: "center", gap: 3, background: "transparent", border: "none", padding: 0, marginTop: 8, color: T.ink, opacity: 0.75, fontSize: 11.5, cursor: "pointer", fontWeight: 600 }}
      >
        Full profile <ChevronRight size={12} />
      </button>
    </div>
  );
}

function MoneyRow({ label, values }) {
  const nums = values.filter((v) => v.value !== null).map((v) => v.value);
  const max = Math.max(1, ...nums);
  return (
    <div style={{ display: "grid", gridTemplateColumns: cols(values.length), alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.line}` }}>
      <div style={{ fontSize: 13, color: T.inkSoft, paddingRight: 12 }}>{label}</div>
      {values.map((v, i) => (
        <div key={i} style={{ padding: "0 14px" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, color: T.ink, marginBottom: 4 }}>
            {v.value === null ? <span style={{ color: T.inkSoft, fontStyle: "italic", fontSize: 12 }}>Not on file</span> : fmtMoney(v.value)}
          </div>
          {v.value !== null && (
            <div style={{ background: T.line, borderRadius: 3, height: 6, overflow: "hidden" }}>
              <div style={{ width: `${Math.max(4, (v.value / max) * 100)}%`, height: "100%", background: partyColor(v.party) }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DetailRow({ label, candidates, render, emptyText = "No public record found" }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: cols(candidates.length), padding: "9px 0", borderTop: `1px dashed ${T.line}` }}>
      <div style={{ fontSize: 12.5, color: T.inkSoft, paddingRight: 12, paddingTop: 2 }}>{label}</div>
      {candidates.map((c) => (
        <div key={c.slug} style={{ fontSize: 13, color: T.ink, padding: "0 14px", lineHeight: 1.45 }}>
          {render(c) ?? <span style={{ color: T.inkSoft, fontStyle: "italic" }}>{emptyText}</span>}
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------
   COMPARISON VIEW — high-level grid across all candidates.
--------------------------------------------------------- */
function HardMetricsSection({ hardMetrics, stateCode }) {
  if (!hardMetrics) return null;
  const unemployment = hardMetrics.unemployment_rate;
  const crime = hardMetrics.violent_crime_rate_per_100k;
  if (!unemployment?.length && !crime?.length) return null;

  const latestUnemployment = unemployment?.[0];
  const yearAgoUnemployment = unemployment?.find((p) => p.month === latestUnemployment?.month && p.year === String(Number(latestUnemployment.year) - 1));
  const latestCrime = crime?.[crime.length - 1];
  const earliestCrime = crime?.[0];

  return (
    <div style={{ background: T.paperRaised, border: `1px solid ${T.line}`, borderRadius: 6, padding: "10px 14px", marginBottom: 18 }}>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: T.ink, padding: "0 4px 4px" }}>
        {stateCode} State Context
      </div>
      {latestUnemployment && (
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", padding: "9px 0", borderTop: `1px dashed ${T.line}` }}>
          <div style={{ fontSize: 12.5, color: T.inkSoft }}>Unemployment rate</div>
          <div style={{ fontSize: 13, color: T.ink }}>
            {latestUnemployment.value}% ({latestUnemployment.month} {latestUnemployment.year})
            {yearAgoUnemployment && <span style={{ color: T.inkSoft }}> — {yearAgoUnemployment.value}% a year prior</span>}
          </div>
        </div>
      )}
      {latestCrime && (
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", padding: "9px 0", borderTop: `1px dashed ${T.line}` }}>
          <div style={{ fontSize: 12.5, color: T.inkSoft }}>Violent crime rate</div>
          <div style={{ fontSize: 13, color: T.ink }}>
            {latestCrime.ratePer100k} per 100k ({latestCrime.year})
            {earliestCrime && earliestCrime.year !== latestCrime.year && (
              <span style={{ color: T.inkSoft }}> — {earliestCrime.ratePer100k} per 100k in {earliestCrime.year}</span>
            )}
          </div>
        </div>
      )}
      <div style={{ fontSize: 11, color: T.inkSoft, padding: "8px 4px 0", fontStyle: "italic" }}>
        Statewide figures (BLS, FBI Crime Data Explorer) shown for context during this term — not a claim that any candidate caused these numbers.
      </div>
    </div>
  );
}

function ComparisonView({ race, chamber, houseRace, senateRace, setChamber, geo, onOpenProfile }) {
  const candidates = race?.candidates ?? [];

  if (!race) {
    return (
      <div style={{ fontSize: 13.5, color: T.inkSoft, display: "flex", alignItems: "center", gap: 8 }}>
        <Info size={15} /> No data built yet for this race.
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: T.successSoft, border: `1px solid ${T.success}`, borderRadius: 6, padding: "12px 14px", marginBottom: 22 }}>
        <CheckCircle2 size={18} color={T.success} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12.5, color: T.inkSoft }}>{geo.stateName} · {geo.districtLabel}</div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => setChamber("house")} disabled={!houseRace} style={{ padding: "10px 18px", borderRadius: 6, border: `1px solid ${chamber === "house" ? T.ink : T.line}`, background: chamber === "house" ? T.ink : T.paperRaised, color: chamber === "house" ? T.paper : T.ink, cursor: houseRace ? "pointer" : "not-allowed", opacity: houseRace ? 1 : 0.5 }}>
            U.S. House
          </button>
          <button onClick={() => setChamber("senate")} disabled={!senateRace} style={{ padding: "10px 18px", borderRadius: 6, border: `1px solid ${chamber === "senate" ? T.ink : T.line}`, background: chamber === "senate" ? T.ink : T.paperRaised, color: chamber === "senate" ? T.paper : T.ink, cursor: senateRace ? "pointer" : "not-allowed", opacity: senateRace ? 1 : 0.5 }}>
            U.S. Senate
          </button>
        </div>
        <Legend />
      </div>

      {/* CANDIDATE TABS */}
      <div className="compare-grid" style={{ display: "grid", gridTemplateColumns: cols(candidates.length), gap: 0, marginBottom: 4 }}>
        <div />
        {candidates.map((c) => (
          <div key={c.slug} style={{ padding: "0 3px" }}>
            <CandidateTab c={c} onOpenProfile={onOpenProfile} />
          </div>
        ))}
      </div>

      {/* AT A GLANCE — financials */}
      <div style={{ background: T.paperRaised, border: `1px solid ${T.line}`, borderTop: "none", padding: "14px 14px 4px", marginBottom: 18 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: T.ink, padding: "0 4px 8px" }}>At a Glance</div>
        <MoneyRow label="Total raised, this cycle" values={candidates.map((c) => ({ value: c.financials?.totalRaised ?? null, party: partyCode(c.party) }))} />
        <MoneyRow label="Total spent, this cycle" values={candidates.map((c) => ({ value: c.financials?.totalSpent ?? null, party: partyCode(c.party) }))} />
        <DetailRow label="Attendance this session" candidates={candidates}
          render={(c) => {
            if (c.performance?.attendance) return `${Math.round(c.performance.attendance.attendanceRate * 100)}%`;
            const text = c.performance ? "Data temporarily unavailable" : "Not currently in office";
            return <span style={{ color: T.inkSoft, fontStyle: "italic" }}>{text}</span>;
          }} />
        <DetailRow label="Bills sponsored / cosponsored" candidates={candidates}
          render={(c) => c.performance
            ? `${c.performance.bills_sponsored ?? "—"} / ${c.performance.bills_cosponsored ?? "—"}${c.performance.bills_became_law ? ` (${c.performance.bills_became_law} became law)` : ""}`
            : null}
          emptyText="Not currently in office" />
        <DetailRow label="Committee assignments" candidates={candidates}
          render={(c) => c.performance ? `${c.performance.committees?.length ?? 0}` : null}
          emptyText="Not currently in office" />
      </div>

      {/* PERSONAL DATA */}
      <div style={{ background: T.paperRaised, border: `1px solid ${T.line}`, borderRadius: 6, padding: "10px 14px 4px", marginBottom: 18 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: T.ink, padding: "0 4px 4px" }}>Personal Data</div>
        <DetailRow label="Date of birth" candidates={candidates} render={(c) => c.bio?.date_of_birth ? <SourcedField field={c.bio.date_of_birth} /> : null} />
        <DetailRow label="Born in" candidates={candidates} render={(c) => c.bio?.birthplace ? <SourcedField field={c.bio.birthplace} /> : null} />
        <DetailRow label="Marital status" candidates={candidates} render={(c) => c.bio?.marital_status ? <SourcedField field={c.bio.marital_status} /> : null} />
        <DetailRow label="High school" candidates={candidates} render={(c) => c.bio?.high_school ? <SourcedField field={c.bio.high_school} /> : null} />
        <DetailRow label="College" candidates={candidates} render={(c) => c.bio?.college ? <SourcedField field={c.bio.college} /> : null} />
        <DetailRow label="Employment record" candidates={candidates} render={(c) => c.bio?.employment_record ? <SourcedField field={c.bio.employment_record} maxLen={70} /> : null} />
        <DetailRow label="Civic affiliations" candidates={candidates} render={(c) => c.bio?.civic_affiliations ? <SourcedField field={c.bio.civic_affiliations} maxLen={70} /> : null} />
        <DetailRow label="Net worth" candidates={candidates} render={(c) => c.bio?.net_worth ? <SourcedField field={c.bio.net_worth} /> : null} />
      </div>

      <HardMetricsSection hardMetrics={race?.hard_metrics} stateCode={race?.state} />

      <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 4, lineHeight: 1.5, borderTop: `1px dashed ${T.line}`, paddingTop: 12 }}>
        Every populated field traces to a public source — linked next to the value. This view is a high-level comparison; click "Full profile" on a candidate for their complete voting record, committee list, and legislative activity.
      </div>
    </>
  );
}

/* ---------------------------------------------------------
   INDIVIDUAL CANDIDATE VIEW — performance + biography detail.
--------------------------------------------------------- */
function CandidateProfileView({ candidate, onBack }) {
  const party = partyCode(candidate.party);
  const perf = candidate.performance;
  return (
    <>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: T.gold, fontSize: 13, cursor: "pointer", fontWeight: 600, marginBottom: 16, padding: 0 }}>
        <ArrowLeft size={15} /> Back to comparison
      </button>

      <div style={{ background: partySoft(party), borderTop: `4px solid ${partyColor(party)}`, borderRadius: 6, padding: "20px 18px", marginBottom: 22 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: partyColor(party), fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>
          {partyName(party)}{candidate.incumbent ? " · Incumbent" : ""}
        </div>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 600, color: T.ink, marginTop: 4 }}>
          {toTitleCase(candidate.full_name)}
        </div>
      </div>

      <div style={{ background: T.paperRaised, border: `1px solid ${T.line}`, borderRadius: 6, padding: "10px 14px", marginBottom: 18 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: T.ink, padding: "6px 4px" }}>Performance on Public Service</div>
        {!perf ? (
          <div style={{ fontSize: 13, color: T.inkSoft, fontStyle: "italic", padding: "9px 4px" }}>Not currently in office — no legislative record yet.</div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", padding: "9px 0", borderTop: `1px dashed ${T.line}` }}>
              <div style={{ fontSize: 12.5, color: T.inkSoft }}>Attendance this session</div>
              <div style={{ fontSize: 13, color: T.ink }}>
                {perf.attendance ? (
                  <><strong>{Math.round(perf.attendance.attendanceRate * 100)}%</strong>{" "}
                  <span style={{ color: T.inkSoft }}>({perf.attendance.votesCast} of {perf.attendance.votesInSession} roll calls)</span></>
                ) : "Not on file"}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", padding: "9px 0", borderTop: `1px dashed ${T.line}` }}>
              <div style={{ fontSize: 12.5, color: T.inkSoft }}>Bills sponsored / cosponsored</div>
              <div style={{ fontSize: 13, color: T.ink }}>{perf.bills_sponsored ?? "—"} / {perf.bills_cosponsored ?? "—"}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", padding: "9px 0", borderTop: `1px dashed ${T.line}` }}>
              <div style={{ fontSize: 12.5, color: T.inkSoft }}>Sponsored bills that became law</div>
              <div style={{ fontSize: 13, color: T.ink }}>{perf.bills_became_law ?? "Not on file"}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", padding: "9px 0", borderTop: `1px dashed ${T.line}` }}>
              <div style={{ fontSize: 12.5, color: T.inkSoft, paddingTop: 2 }}>Committee assignments</div>
              <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.7 }}>
                {perf.committees?.length ? perf.committees.map((cm, i) => <div key={i}>{cm.committee}</div>) : "None on file"}
              </div>
            </div>
          </>
        )}
      </div>

      <div style={{ background: T.paperRaised, border: `1px solid ${T.line}`, borderRadius: 6, padding: "10px 14px", marginBottom: 18 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: T.ink, padding: "6px 4px" }}>Personal Data</div>
        {["date_of_birth", "birthplace", "high_school", "college", "marital_status", "employment_record", "civic_affiliations"].map((key) => {
          const field = candidate.bio?.[key];
          return (
            <div key={key} style={{ padding: "9px 0", borderTop: `1px dashed ${T.line}` }}>
              <div style={{ display: "grid", gridTemplateColumns: "220px 1fr" }}>
                <div style={{ fontSize: 12.5, color: T.inkSoft, textTransform: "capitalize" }}>{key.replace(/_/g, " ")}</div>
                <div style={{ fontSize: 13, color: T.ink }}><SourcedField field={field} /></div>
              </div>
              {field?.snippet && (
                <div style={{ marginLeft: 220, marginTop: 4, fontSize: 12, color: T.inkSoft, fontStyle: "italic", borderLeft: `2px solid ${T.line}`, paddingLeft: 8 }}>
                  "{field.snippet}"
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ background: T.paperRaised, border: `1px solid ${T.line}`, borderRadius: 6, padding: "10px 14px", marginBottom: 18 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: T.ink, padding: "6px 4px" }}>Recent Votes</div>
        {(candidate.recent_votes ?? []).length === 0 ? (
          <div style={{ fontSize: 13, color: T.inkSoft, fontStyle: "italic", padding: "9px 4px" }}>No voting record — not currently in office.</div>
        ) : (
          candidate.recent_votes.map((v, i) => (
            <div key={i} style={{ padding: "10px 4px", borderTop: i > 0 ? `1px dashed ${T.line}` : "none" }}>
              <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.4 }}>
                <strong>{v.position}</strong> — {v.question || v.title}
              </div>
              <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>
                {v.billTitle || v.title} · {v.date}{" "}
                <a href={v.sourceUrl} target="_blank" rel="noreferrer" style={{ color: T.gold }}>source</a>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ background: T.paperRaised, border: `1px solid ${T.line}`, borderRadius: 6, padding: "10px 14px" }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: T.ink, padding: "6px 4px" }}>Campaign Finance</div>
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", padding: "9px 0", borderTop: `1px dashed ${T.line}` }}>
          <div style={{ fontSize: 12.5, color: T.inkSoft }}>Total raised, this cycle</div>
          <div style={{ fontSize: 13, color: T.ink }}>{fmtMoney(candidate.financials?.totalRaised) ?? "Not on file"}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", padding: "9px 0", borderTop: `1px dashed ${T.line}` }}>
          <div style={{ fontSize: 12.5, color: T.inkSoft }}>Total spent, this cycle</div>
          <div style={{ fontSize: 13, color: T.ink }}>{fmtMoney(candidate.financials?.totalSpent) ?? "Not on file"}</div>
        </div>
      </div>
    </>
  );
}

export default function App() {
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [error, setError] = useState("");
  const [geo, setGeo] = useState(null);
  const [chamber, setChamber] = useState("house");
  const [houseRace, setHouseRace] = useState(null);
  const [senateRace, setSenateRace] = useState(null);
  const [profileSlug, setProfileSlug] = useState(null);

  const handleSearch = async () => {
    if (!address.trim()) return;
    setStatus("loading");
    setError("");
    setProfileSlug(null);
    try {
      const resolvedGeo = await geocodeAddress(address);
      setGeo(resolvedGeo);
      const [house, senate] = await Promise.all([
        fetchRace("house", resolvedGeo.stusab, resolvedGeo.districtCode),
        fetchRace("senate", resolvedGeo.stusab, resolvedGeo.districtCode),
      ]);
      setHouseRace(house);
      setSenateRace(senate);
      setChamber(house ? "house" : "senate");
      setStatus("ready");
    } catch (err) {
      setError(err.message || "Something went wrong looking up that address.");
      setStatus("error");
    }
  };

  const activeRace = chamber === "house" ? houseRace : senateRace;
  const profileCandidate = profileSlug ? activeRace?.candidates.find((c) => c.slug === profileSlug) : null;

  return (
    <div style={{ background: T.paper, minHeight: "100vh", fontFamily: "'IBM Plex Sans', sans-serif", color: T.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
        input:focus, button:focus-visible { outline: 2px solid ${T.gold}; outline-offset: 2px; }
        @media (max-width: 760px) {
          .compare-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ borderBottom: `1px solid ${T.line}`, padding: "16px 20px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700, color: T.ink }}>Ballot-Wise</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: T.inkSoft }}>
            The congressional record, compared
          </span>
        </div>
      </div>

      <div style={{ borderBottom: `1px solid ${T.line}`, padding: "40px 20px 32px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 600, margin: "0 0 10px", lineHeight: 1.1 }}>
            Know who's on your ballot.
          </h1>
          <p style={{ color: T.inkSoft, fontSize: 15, lineHeight: 1.55, maxWidth: 580 }}>
            Enter your home address to see every candidate running for Congress where you live — House and Senate — laid out side by side.
          </p>

          <div style={{ display: "flex", gap: 8, marginTop: 22, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.paperRaised, border: `1px solid ${T.line}`, borderRadius: 6, padding: "10px 14px", flex: "1 1 280px" }}>
              <MapPin size={16} color={T.inkSoft} />
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Street address, city, state, ZIP"
                style={{ border: "none", background: "transparent", fontSize: 14, width: "100%", color: T.ink }}
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={status === "loading"}
              style={{ display: "flex", alignItems: "center", gap: 8, background: T.ink, color: T.paper, border: "none", borderRadius: 6, padding: "10px 18px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
            >
              <Search size={15} /> {status === "loading" ? "Looking up…" : "Find my ballot"}
            </button>
          </div>
        </div>
      </div>

      {status === "error" && (
        <div style={{ maxWidth: 760, margin: "20px auto 0", padding: "0 20px" }}>
          <div style={{ display: "flex", gap: 10, background: T.warnSoft, border: `1px solid ${T.warn}`, borderRadius: 6, padding: "12px 14px" }}>
            <AlertTriangle size={18} color={T.warn} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13.5, color: T.ink }}>{error}</div>
          </div>
        </div>
      )}

      {status === "ready" && (
        <div style={{ maxWidth: 920, margin: "0 auto", padding: "28px 20px 60px" }}>
          {profileCandidate ? (
            <CandidateProfileView candidate={profileCandidate} onBack={() => setProfileSlug(null)} />
          ) : (
            <ComparisonView
              race={activeRace}
              chamber={chamber}
              houseRace={houseRace}
              senateRace={senateRace}
              setChamber={(c) => { setChamber(c); setProfileSlug(null); }}
              geo={geo}
              onOpenProfile={setProfileSlug}
            />
          )}
        </div>
      )}
    </div>
  );
}
