import React, { useState, useEffect, useRef } from "react";
import { Search, MapPin, Info, CheckCircle2, AlertTriangle, ExternalLink, ArrowLeft, ChevronRight, ChevronDown, ArrowUp, ArrowDown, X, Link2, Printer, Flag } from "lucide-react";

const T = {
  paper: "#F4F1E9", paperRaised: "#FBFAF6", ink: "#211D18", inkSoft: "#6B6255",
  line: "#DAD2BF", gold: "#8C6D1F", rep: "#A83A2D", repSoft: "#F3E1DC",
  dem: "#28587E", demSoft: "#DEE8EF", ind: "#B36A00", indSoft: "#F6E3C8",
  lib: "#6B4A7D", libSoft: "#E9E5EC", grn: "#4F6B2A", grnSoft: "#E5E9DE",
  success: "#3C7A54", successSoft: "#DFEBE2", warn: "#8C6D1F", warnSoft: "#F1E9D4",
};

// Dark palette for the marketing landing hero only — scoped to that section,
// not a site-wide theme, so the tested comparison/profile views below are
// untouched. Accent is the existing brand gold (T.gold), not red: this site
// deliberately keeps red/blue meaning one thing only (Republican/Democrat,
// see partyColor) everywhere else on the page, so a decorative brand accent
// in the same color family would read as an unintended partisan signal the
// moment someone scrolls from the hero into the actual candidate comparison.
const D = {
  bg: "#17140F", bgRaised: "#211C16", ink: "#F4F1E9", inkSoft: "#B3A99A",
  line: "#3A332A", accent: "#C9A227",
};

const DATA_BASE = import.meta.env.VITE_DATA_BASE_URL || "";

// USPS state abbreviation -> full name, for the direct-district-entry
// fallback (parseDistrictInput below), which never gets a state name back
// from Census the way geocodeAddress's result does.
const STATE_NAMES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

// Bucketed for COLOR only — R/D plus the two other parties common enough
// nationally to earn a distinct color (Libertarian, Green). Every rarer
// party (Constitution, Forward, No Labels, true independents, unknown)
// shares the "I" color bucket — a distinct color per one-off minor party
// wouldn't scale. See partyLabel below for why the TEXT label doesn't
// flatten the same way.
function partyCode(fecPartyFull) {
  if (/republican/i.test(fecPartyFull)) return "R";
  if (/democrat/i.test(fecPartyFull)) return "D";
  if (/libertarian/i.test(fecPartyFull)) return "L";
  if (/green/i.test(fecPartyFull)) return "G";
  return "I";
}
const partyColor = (p) => ({ R: T.rep, D: T.dem, L: T.lib, G: T.grn }[p] ?? T.ind);
const partySoft = (p) => ({ R: T.repSoft, D: T.demSoft, L: T.libSoft, G: T.grnSoft }[p] ?? T.indSoft);

// Takes the RAW FEC party string (not partyCode's bucket letter), so a
// rare party can show its own real name instead of being flattened to
// "Independent" — a Libertarian or Forward Party candidate is not an
// independent, even though they share a legend color with one here.
function partyLabel(fecPartyFull) {
  if (!fecPartyFull || /^independent$/i.test(fecPartyFull.trim())) return "Independent";
  if (/republican/i.test(fecPartyFull)) return "Republican";
  if (/democrat/i.test(fecPartyFull)) return "Democrat";
  if (/libertarian/i.test(fecPartyFull)) return "Libertarian";
  if (/green/i.test(fecPartyFull)) return "Green";
  return fecPartyFull
    .replace(/\bparty\b/i, "")
    // Strip stray leading/trailing hyphens left behind by removing "party"
    // out of a hyphenated string like "NON-PARTY" (-> "Non", not "Non-").
    // Internal hyphens (e.g. "WRITE-IN") are untouched.
    .replace(/^[\s-]+|[\s-]+$/g, "")
    .split(/\s+/)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

// Parses "YYYY-MM-DD" as LOCAL date components, not UTC — new Date("2026-09-15")
// parses as UTC midnight, which displays as Sep 14 in US timezones. This avoids that.
function fmtElectionDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
// minmax floor keeps a candidate column from being squeezed unreadably
// thin when there are many candidates (10+ in a crowded primary) — past
// that floor the comparison area scrolls horizontally as one unit instead
// of everything cramming into the viewport width.
const cols = (n) => `180px repeat(${n}, minmax(150px, 1fr))`;
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
  let data;
  try {
    data = await res.json();
  } catch {
    // A non-JSON body here means an upstream/edge failure slipped through
    // (e.g. a block page) rather than our own API's clean JSON error shape.
    throw new Error("Address lookup service is temporarily unavailable. Please try again in a moment.");
  }
  if (!res.ok) throw new Error(data?.error || "Address lookup failed.");
  const match = data.result?.addressMatches?.[0];
  if (!match) throw new Error("Couldn't resolve that address to a district. Check the spelling and try again.");

  if (match.ballotWiseRedistrictingUncertain) {
    const { state: uncertainState, countyName } = match.ballotWiseRedistrictingUncertain;
    const err = new Error(
      `We can't find your candidates because ${countyName} redrew its congressional districts for 2026, and your address now falls in an area that spans more than one new district. Call your county board of elections to get your new district number, then enter it below to see your candidates.`
    );
    // Lets the direct-entry fallback show an example in the voter's OWN
    // state ("FL-23") instead of a fixed one ("NC-04") that reads as a
    // literal instruction rather than a format to fill in.
    err.exampleState = uncertainState;
    throw err;
  }

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

// Accepts the shorthand voters already see elsewhere (Ballotpedia, news
// coverage): "NC-04", "NC 4", "NC-AL", "NC at-large". Returns null (not a
// thrown error) for anything unparseable, so the caller can show one plain
// "couldn't read that" message instead of surfacing validation internals.
function parseDistrictInput(raw) {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, " ");
  const m = cleaned.match(/^([A-Z]{2})[\s-]+(\d{1,2}|AL|AT[\s-]?LARGE)$/);
  if (!m) return null;
  const [, stusab, distRaw] = m;
  if (!STATE_NAMES[stusab]) return null;
  const districtCode = /^(AL|AT[\s-]?LARGE)$/.test(distRaw) ? "AL" : String(Number(distRaw));
  return { stusab, districtCode };
}

async function fetchRace(chamber, stusab, districtCode) {
  const path = chamber === "house" ? `house/${stusab}-${districtCode}.json` : `senate/${stusab}.json`;
  const res = await fetch(`${DATA_BASE}/${path}`);
  if (res.status === 404) return null; // no built race for this district yet — not an error, just not covered
  if (!res.ok) throw new Error(`Couldn't load candidate data (${res.status}).`);
  return res.json();
}

// This app has no router — home/results/profile are plain React state, and
// until now nothing ever touched window.history. That meant the browser's
// real back button had no in-app history to walk: a visit to an external
// link (a source citation, or the campaign-video link) that for any reason
// didn't open in a new tab — a browser/PWA/in-app-webview that doesn't
// honor target="_blank" — would return to a full reload of "/", landing on
// the home screen instead of the candidate page the user was just on. These
// two helpers turn {stusab, districtCode, chamber, profile} into a URL and
// back, so every real navigation step can get a genuine history entry.
function buildAppUrl({ stusab, districtCode, chamber, profile } = {}) {
  if (!stusab || !districtCode) return "/";
  const params = new URLSearchParams({ state: stusab, district: districtCode });
  if (chamber) params.set("chamber", chamber);
  if (profile) params.set("profile", profile);
  return `/?${params.toString()}`;
}

function parseAppUrl(search) {
  const params = new URLSearchParams(search);
  const stusab = params.get("state");
  const districtCode = params.get("district");
  if (!stusab || !districtCode) return null;
  return { stusab, districtCode, chamber: params.get("chamber") || undefined, profile: params.get("profile") || null };
}

function truncateText(text, maxLen) {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  return cut.slice(0, cut.lastIndexOf(" ")) + "…";
}

// platform_video_url is always the https://www.youtube.com/watch?v=ID shape
// campaignVideo.ts constructs on the pipeline side — no need to duplicate
// its fuller URL-shape parsing here.
function youTubeVideoId(videoUrl) {
  try {
    return new URL(videoUrl).searchParams.get("v");
  } catch {
    return null;
  }
}

// youtube-nocookie.com/embed/ID is YouTube's own minimal player: just the
// video, no comments, no channel page, no recommendations sidebar, and no
// tracking cookie until the visitor actually presses play. rel=0 further
// restricts any related videos shown after playback ends to the same
// channel, instead of arbitrary third-party content. Deliberately used in
// place of the full youtube.com/watch page everywhere this app links to a
// candidate's video, so visitors aren't routed into the wider site.
function youTubeEmbedUrl(videoUrl) {
  const id = youTubeVideoId(videoUrl);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null;
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
        <a href={field.source_url} target="_blank" rel="noreferrer noopener" style={{ color: T.gold, marginLeft: 4 }} title={field.snippet || label}>
          <ExternalLink size={11} style={{ verticalAlign: "middle" }} />
        </a>
      )}
    </span>
  );
}

function FinancialDisclosureField({ fd }) {
  if (!fd) return <span style={{ color: T.inkSoft, fontStyle: "italic" }}>No public record found</span>;
  const categories = [
    [fd.hasReportableAssets, "assets"],
    [fd.hasEarnedIncome, "income"],
    [fd.hasReportableLiabilities, "liabilities"],
    [fd.hasReportablePositions, "outside positions"],
    [fd.hasOutsideAgreements, "outside agreements"],
  ];
  const disclosed = categories.filter(([v]) => v === true).map(([, label]) => label);
  const summary = disclosed.length ? `Reportable ${disclosed.join(", ")}` : "No reportable categories";
  return (
    <span>
      {summary}{" "}
      <a href={fd.pdfUrl} target="_blank" rel="noreferrer noopener" style={{ color: T.gold, marginLeft: 4 }} title={`Filed ${fd.filingDate} — full filing (ranges only, not exact amounts, per federal disclosure law)`}>
        <ExternalLink size={11} style={{ verticalAlign: "middle" }} />
      </a>
    </span>
  );
}

// State-mandated background check is a statutory fact about the OFFICE, not
// the individual candidate — every candidate in a given race gets the exact
// same answer. Shown once, race-wide, instead of repeating an identical row
// across every column.
function StateBackgroundCheckBanner({ field }) {
  if (!field) return null;
  const isNo = field.value.startsWith("No");
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: isNo ? T.repSoft : T.successSoft, border: `1px solid ${isNo ? T.rep : T.success}`, borderRadius: 6, padding: "10px 14px", marginBottom: 14 }}>
      <AlertTriangle size={16} color={isNo ? T.rep : T.success} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ fontSize: 12.5, color: T.ink }}>
        <strong>State-mandated background check: </strong>
        <SourcedField field={field} maxLen={160} />
        <span style={{ color: T.inkSoft }}> — applies equally to every candidate in this race.</span>
      </div>
    </div>
  );
}

// Only rendered once a state's primary has actually narrowed this race's
// candidate list (most races have no filter registered yet and this stays
// absent, same as before). A plain citation line rather than a colored
// alert like the banner above: that one is a warning about missing
// vetting, this is neutral context about which candidates are shown here
// and why — same "every fact traces to a source" standard as everything
// else on the page, just applied to the list itself rather than one field.
function PrimaryResultsNote({ primaryResults }) {
  if (!primaryResults) return null;
  return (
    <div style={{ fontSize: 11.5, color: T.inkSoft, fontStyle: "italic", padding: "0 4px", marginBottom: 14 }}>
      Narrowed to confirmed general-election candidates per official primary results.{" "}
      <a href={primaryResults.source_url} target="_blank" rel="noreferrer noopener" style={{ color: T.gold }} title={primaryResults.snippet}>
        source <ExternalLink size={10} style={{ verticalAlign: "middle" }} />
      </a>
    </div>
  );
}

// Most races use a standard partisan-primary-then-general process a voter
// can safely assume without being told. A handful of states run something
// genuinely different (nonpartisan blanket primaries, ranked-choice
// generals, same-party generals) where assuming the standard process would
// actively mislead a voter about how their ballot works — shown once,
// race-wide, same reasoning as StateBackgroundCheckBanner above. Absent
// (null) for every standard race, which today is all of them.
function VotingSystemNote({ votingSystem }) {
  if (!votingSystem) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: T.warnSoft, border: `1px solid ${T.warn}`, borderRadius: 6, padding: "10px 14px", marginBottom: 14 }}>
      <Info size={16} color={T.warn} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ fontSize: 12.5, color: T.ink }}>
        <strong>{votingSystem.label}: </strong>
        {votingSystem.primaryExplanation}{" "}
        <a href={votingSystem.primarySourceUrl} target="_blank" rel="noreferrer noopener" style={{ color: T.gold }} title={votingSystem.primarySnippet}>
          source <ExternalLink size={10} style={{ verticalAlign: "middle" }} />
        </a>{" "}
        {votingSystem.generalExplanation}{" "}
        <a href={votingSystem.generalSourceUrl} target="_blank" rel="noreferrer noopener" style={{ color: T.gold }} title={votingSystem.generalSnippet}>
          source <ExternalLink size={10} style={{ verticalAlign: "middle" }} />
        </a>
      </div>
    </div>
  );
}

// Only shown when a candidate in THIS race actually uses that bucket, so
// the legend never advertises a color that doesn't appear anywhere here.
// R/D used to always render regardless — reasoned as a rare mid-race gap —
// but checked empirically against every currently-built race: 23 already
// have no Republican, 4 already have no Democrat, and a same-party general
// (California/Washington's top-two primaries can produce one) makes a
// missing party the guaranteed norm rather than a rare gap for some states.
function Legend({ candidates }) {
  const present = new Set(candidates.map((c) => partyCode(c.party)));
  const items = [
    ["R", "Republican"], ["D", "Democrat"], ["L", "Libertarian"], ["G", "Green"], ["I", "Independent / Other"],
  ].filter(([p]) => present.has(p));
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

function CandidateTab({ c, onOpenProfile, primaryNarrowed }) {
  const party = partyCode(c.party);
  return (
    <div style={{ background: partySoft(party), borderTop: `4px solid ${partyColor(party)}`, borderRadius: "6px 6px 0 0", padding: "16px 14px 12px" }}>
      <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: partyColor(party), fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>
        {partyLabel(c.party)}{c.incumbent ? " · Incumbent" : ""}
      </div>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600, color: T.ink, marginTop: 2, lineHeight: 1.2 }}>
        {toTitleCase(c.full_name)}
      </div>
      {/* A confirmed general-election advancer (this race went through
          primary_results narrowing) is never "early-stage" regardless of
          FEC's own low-fundraising status code — see the primaryNarrowed
          comment above ComparisonView's candidates/earlyStage split. */}
      {c.fec_status === "N" && !primaryNarrowed && (
        <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 3, fontStyle: "italic" }} title="Filed a Statement of Candidacy with the FEC but hasn't yet crossed the $5,000 raised/spent threshold for established-filer status">
          Declared candidate, early-stage filing
        </div>
      )}
      <button
        onClick={() => onOpenProfile(c.slug)}
        style={{ display: "flex", alignItems: "center", gap: 3, background: "transparent", border: "none", padding: 0, marginTop: 8, color: T.ink, opacity: 0.75, fontSize: 11.5, cursor: "pointer", fontWeight: 600 }}
      >
        Full profile <ChevronRight size={12} />
      </button>
    </div>
  );
}

function fundingSummary(fundingSources) {
  if (!fundingSources) return null;
  const segments = [
    ["large-dollar", fundingSources.largeDollar],
    ["small-dollar", fundingSources.smallDollar],
    ["PAC", fundingSources.pac],
    ["party", fundingSources.party],
    ["self-funded", fundingSources.selfFunded],
  ].filter(([, v]) => v);
  const total = segments.reduce((sum, [, v]) => sum + v, 0);
  if (!total) return null;
  return segments
    .map(([label, v]) => [label, Math.round((v / total) * 100)])
    // A segment can be genuinely nonzero yet round to 0% (e.g. $50 of
    // $500,000) — drop it rather than show a misleading "0% self-funded".
    .filter(([, pct]) => pct > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([label, pct]) => `${pct}% ${label}`)
    .join(" · ");
}

// A horizontal -1..+1 track with a marker at the member's position. No
// discrete labels ("moderate", "very liberal", etc.) are drawn on the scale
// deliberately — where those buckets fall is itself a judgment call this
// nonpartisan project doesn't make. The number and its position speak for
// themselves; a center tick at 0 is the only reference point given.
function IdeologyScale({ value, width = 100 }) {
  const clamped = Math.max(-1, Math.min(1, value));
  const pct = ((clamped + 1) / 2) * 100;
  return (
    <div style={{ width }}>
      <div style={{ position: "relative", height: 10, marginTop: 3 }}>
        <div style={{ position: "absolute", top: 3, left: 0, right: 0, height: 4, background: T.line, borderRadius: 2 }} />
        <div style={{ position: "absolute", top: 0, left: "50%", width: 1, height: 10, background: T.inkSoft, opacity: 0.5 }} />
        <div style={{ position: "absolute", top: 0, left: `calc(${pct}% - 3px)`, width: 6, height: 10, borderRadius: 2, background: T.ink }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, fontWeight: 600, marginTop: 3, whiteSpace: "nowrap" }}>
        <span style={{ color: T.dem }}>D</span>
        <span style={{ color: T.rep }}>R</span>
      </div>
    </div>
  );
}

function FundingBreakdown({ fundingSources }) {
  const summary = fundingSummary(fundingSources);
  return summary ? <span>{summary}</span> : null;
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
// betterDirection: "down" (lower is better, e.g. unemployment, crime), "up"
// (higher is better, e.g. jobs), or null (no defensible value judgment —
// e.g. federal spending isn't inherently good or bad, so shown neutrally).
function TrendIndicator({ current, previous, betterDirection }) {
  if (current === previous) return null;
  const wentUp = current > previous;
  const Arrow = wentUp ? ArrowUp : ArrowDown;
  const isGood = betterDirection && (betterDirection === "up") === wentUp;
  const color = !betterDirection ? T.inkSoft : isGood ? T.success : T.rep;
  return <Arrow size={15} color={color} strokeWidth={3.5} style={{ verticalAlign: "middle", marginRight: 4 }} />;
}

function HardMetricsSection({ hardMetrics, stateCode }) {
  if (!hardMetrics) return null;
  const unemployment = hardMetrics.unemployment_rate;
  const crime = hardMetrics.violent_crime_rate_per_100k;
  const employment = hardMetrics.nonfarm_employment_thousands;
  const spending = hardMetrics.federal_spending;
  const population = hardMetrics.population;
  const income = hardMetrics.median_household_income;
  if (!unemployment?.length && !crime?.length && !employment?.length && !spending?.length && !population?.length && !income?.length) return null;

  const latestPopulation = population?.[population.length - 1];
  const earliestPopulation = population?.[0];

  const latestIncome = income?.[income.length - 1];
  const earliestIncome = income?.[0];

  const latestSpending = spending?.[spending.length - 1];
  const earliestSpending = spending?.[0];
  const fmtUsd = (n) => `$${(n / 1e9).toFixed(1)}B`;

  const latestUnemployment = unemployment?.[0];
  const yearAgoUnemployment = unemployment?.find((p) => p.month === latestUnemployment?.month && p.year === String(Number(latestUnemployment.year) - 1));
  const latestCrime = crime?.[crime.length - 1];
  const earliestCrime = crime?.[0];
  const latestEmployment = employment?.[0];
  const yearAgoEmployment = employment?.find((p) => p.month === latestEmployment?.month && p.year === String(Number(latestEmployment.year) - 1));

  return (
    <div style={{ background: T.paperRaised, border: `1px solid ${T.line}`, borderRadius: 6, padding: "10px 14px", marginBottom: 18 }}>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: T.ink, padding: "0 4px 4px" }}>
        {stateCode} State Context
      </div>
      {latestPopulation && (
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", padding: "9px 0", borderTop: `1px dashed ${T.line}` }}>
          <div style={{ fontSize: 12.5, color: T.inkSoft }}>Population</div>
          <div style={{ fontSize: 13, color: T.ink }}>
            {earliestPopulation && earliestPopulation.year !== latestPopulation.year && (
              <TrendIndicator current={latestPopulation.population} previous={earliestPopulation.population} betterDirection={null} />
            )}
            {latestPopulation.population.toLocaleString("en-US")} ({latestPopulation.year})
            {earliestPopulation && earliestPopulation.year !== latestPopulation.year && (
              <span style={{ color: T.inkSoft }}> — {earliestPopulation.population.toLocaleString("en-US")} in {earliestPopulation.year}</span>
            )}
          </div>
        </div>
      )}
      {latestIncome && (
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", padding: "9px 0", borderTop: `1px dashed ${T.line}` }}>
          <div style={{ fontSize: 12.5, color: T.inkSoft }}>Median household income</div>
          <div style={{ fontSize: 13, color: T.ink }}>
            {earliestIncome && earliestIncome.year !== latestIncome.year && (
              <TrendIndicator current={latestIncome.medianHouseholdIncomeUsd} previous={earliestIncome.medianHouseholdIncomeUsd} betterDirection={null} />
            )}
            ${latestIncome.medianHouseholdIncomeUsd.toLocaleString("en-US")} ({latestIncome.year})
            {earliestIncome && earliestIncome.year !== latestIncome.year && (
              <span style={{ color: T.inkSoft }}> — ${earliestIncome.medianHouseholdIncomeUsd.toLocaleString("en-US")} in {earliestIncome.year}</span>
            )}
          </div>
        </div>
      )}
      {latestUnemployment && (
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", padding: "9px 0", borderTop: `1px dashed ${T.line}` }}>
          <div style={{ fontSize: 12.5, color: T.inkSoft }}>Unemployment rate</div>
          <div style={{ fontSize: 13, color: T.ink }}>
            {yearAgoUnemployment && (
              <TrendIndicator current={latestUnemployment.value} previous={yearAgoUnemployment.value} betterDirection="down" />
            )}
            {latestUnemployment.value}% ({latestUnemployment.month} {latestUnemployment.year})
            {yearAgoUnemployment && (
              <span style={{ color: T.inkSoft }}> — {yearAgoUnemployment.value}% a year prior</span>
            )}
          </div>
        </div>
      )}
      {latestEmployment && (
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", padding: "9px 0", borderTop: `1px dashed ${T.line}` }}>
          <div style={{ fontSize: 12.5, color: T.inkSoft }}>Total nonfarm jobs</div>
          <div style={{ fontSize: 13, color: T.ink }}>
            {yearAgoEmployment && (
              <TrendIndicator current={latestEmployment.thousandsOfJobs} previous={yearAgoEmployment.thousandsOfJobs} betterDirection="up" />
            )}
            {(latestEmployment.thousandsOfJobs * 1000).toLocaleString("en-US")} ({latestEmployment.month} {latestEmployment.year})
            {yearAgoEmployment && (
              <span style={{ color: T.inkSoft }}>
                {" "}— {latestEmployment.thousandsOfJobs > yearAgoEmployment.thousandsOfJobs ? "up" : "down"} from{" "}
                {(yearAgoEmployment.thousandsOfJobs * 1000).toLocaleString("en-US")} a year prior
              </span>
            )}
          </div>
        </div>
      )}
      {latestCrime && (
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", padding: "9px 0", borderTop: `1px dashed ${T.line}` }}>
          <div style={{ fontSize: 12.5, color: T.inkSoft }}>Violent crime rate</div>
          <div style={{ fontSize: 13, color: T.ink }}>
            {earliestCrime && earliestCrime.year !== latestCrime.year && (
              <TrendIndicator current={latestCrime.ratePer100k} previous={earliestCrime.ratePer100k} betterDirection="down" />
            )}
            {latestCrime.ratePer100k} per 100k ({latestCrime.year})
            {earliestCrime && earliestCrime.year !== latestCrime.year && (
              <span style={{ color: T.inkSoft }}> — {earliestCrime.ratePer100k} per 100k in {earliestCrime.year}</span>
            )}
          </div>
        </div>
      )}
      {latestSpending && (
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", padding: "9px 0", borderTop: `1px dashed ${T.line}` }}>
          <div style={{ fontSize: 12.5, color: T.inkSoft }}>Federal spending in district</div>
          <div style={{ fontSize: 13, color: T.ink }}>
            {earliestSpending && earliestSpending.year !== latestSpending.year && (
              <TrendIndicator current={latestSpending.totalUsd} previous={earliestSpending.totalUsd} betterDirection={null} />
            )}
            {fmtUsd(latestSpending.totalUsd)} ({latestSpending.year}) · ${Math.round(latestSpending.perCapitaUsd).toLocaleString("en-US")} per capita
            {earliestSpending && earliestSpending.year !== latestSpending.year && (
              <span style={{ color: T.inkSoft }}> — {fmtUsd(earliestSpending.totalUsd)} in {earliestSpending.year}</span>
            )}
          </div>
        </div>
      )}
      <div style={{ fontSize: 11, color: T.inkSoft, padding: "8px 4px 0", fontStyle: "italic" }}>
        Statewide figures (Census, BLS, FBI Crime Data Explorer, USAspending.gov) shown for context during this term — not a claim that any candidate caused or personally secured these numbers.
      </div>
    </div>
  );
}

function EarlyStageSection({ candidates, onOpenProfile }) {
  const [open, setOpen] = useState(false);
  if (!candidates.length) return null;
  return (
    <div style={{ background: T.paperRaised, border: `1px solid ${T.line}`, borderRadius: 6, marginBottom: 18, overflow: "hidden" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: T.ink }}>
          Also filed — {candidates.length} early-stage declared candidate{candidates.length === 1 ? "" : "s"}
        </span>
        <ChevronDown size={16} color={T.inkSoft} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      {open && (
        <div style={{ padding: "0 14px 12px" }}>
          <div style={{ fontSize: 11.5, color: T.inkSoft, marginBottom: 8, fontStyle: "italic" }}>
            Filed a Statement of Candidacy with the FEC but hasn't crossed the $5,000 raised/spent threshold for established-filer status.
          </div>
          {candidates.map((c) => (
            <div key={c.slug} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: `1px dashed ${T.line}` }}>
              <div style={{ fontSize: 13, color: T.ink }}>
                <span style={{ color: partyColor(partyCode(c.party)), fontWeight: 600 }}>{partyCode(c.party)}</span> · {toTitleCase(c.full_name)}
              </div>
              <button onClick={() => onOpenProfile(c.slug)} style={{ background: "transparent", border: "none", color: T.gold, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                Full profile →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Incumbent first (there's rarely more than one), then everyone else by
// how much they've raised — a reasonable proxy for a viable campaign, and
// more useful to lead with than FEC's own (effectively arbitrary) ordering.
function byIncumbentThenBudget(a, b) {
  if (Boolean(a.incumbent) !== Boolean(b.incumbent)) return a.incumbent ? -1 : 1;
  return (b.financials?.totalRaised ?? 0) - (a.financials?.totalRaised ?? 0);
}

function ComparisonView({ race, chamber, houseRace, senateRace, setChamber, geo, onOpenProfile }) {
  const allCandidates = race?.candidates ?? [];
  // fec_status "N" (declared, under FEC's $5,000 established-filer
  // threshold) is normally a solid proxy for "early-stage, not yet a real
  // contender" — but not when a race's own primary_results narrowing has
  // already confirmed every candidate on this list as a general-election
  // advancer regardless of how much they've raised. First surfaced by
  // Alaska's top-4 nonpartisan primary: 2 of its 4 CONFIRMED
  // general-election candidates (Hafner, Williams) both carry fec_status
  // "N" from low fundraising, which — before this check — put them in the
  // "early-stage declared candidate" bucket alongside genuine primary-stage
  // long shots, wrongly implying they hadn't actually secured a spot on
  // the general-election ballot when they clearly had.
  const primaryNarrowed = Boolean(race?.primary_results);
  const candidates = allCandidates.filter((c) => primaryNarrowed || c.fec_status !== "N").sort(byIncumbentThenBudget);
  const earlyStage = primaryNarrowed ? [] : allCandidates.filter((c) => c.fec_status === "N").sort(byIncumbentThenBudget);

  if (!race) {
    return (
      <div style={{ fontSize: 13.5, color: T.inkSoft, display: "flex", alignItems: "center", gap: 8 }}>
        <Info size={15} /> No data built yet for this race.
      </div>
    );
  }

  if (!candidates.length) {
    return (
      <>
        <div style={{ fontSize: 13.5, color: T.inkSoft, display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <Info size={15} /> No established-filer candidates yet for this race.
        </div>
        <EarlyStageSection candidates={earlyStage} onOpenProfile={onOpenProfile} />
      </>
    );
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: T.successSoft, border: `1px solid ${T.success}`, borderRadius: 6, padding: "12px 14px", marginBottom: 14 }}>
        <CheckCircle2 size={18} color={T.success} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12.5, color: T.inkSoft }}>
          {geo.stateName} · {geo.districtLabel}
          {race?.election_dates && (
            <span> —{" "}
              {!race.primary_results && (
                <>Primary: <strong style={{ color: T.ink }}>{fmtElectionDate(race.election_dates.primaryDate)}</strong> · </>
              )}
              General Election Day: <strong style={{ color: T.ink }}>{fmtElectionDate(race.election_dates.generalDate)}</strong>
              {race.election_dates.runoffDate && (
                <> · Runoff (if needed): <strong style={{ color: T.ink }}>{fmtElectionDate(race.election_dates.runoffDate)}</strong></>
              )}
            </span>
          )}
        </div>
      </div>

      <VotingSystemNote votingSystem={race?.voting_system} />
      <StateBackgroundCheckBanner field={race?.state_background_check} />
      <PrimaryResultsNote primaryResults={race?.primary_results} />

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => setChamber("house")} disabled={!houseRace} style={{ padding: "10px 18px", borderRadius: 6, border: `1px solid ${chamber === "house" ? T.ink : T.line}`, background: chamber === "house" ? T.ink : T.paperRaised, color: chamber === "house" ? T.paper : T.ink, cursor: houseRace ? "pointer" : "not-allowed", opacity: houseRace ? 1 : 0.5 }}>
            U.S. House
          </button>
          <button onClick={() => setChamber("senate")} disabled={!senateRace} style={{ padding: "10px 18px", borderRadius: 6, border: `1px solid ${chamber === "senate" ? T.ink : T.line}`, background: chamber === "senate" ? T.ink : T.paperRaised, color: chamber === "senate" ? T.paper : T.ink, cursor: senateRace ? "pointer" : "not-allowed", opacity: senateRace ? 1 : 0.5 }}>
            U.S. Senate
          </button>
        </div>
        <Legend candidates={[...candidates, ...earlyStage]} />
      </div>

      {/* CANDIDATE TABS through CAMPAIGN PLATFORM share one scroll container so
          a crowded race (10+ candidates) scrolls horizontally as a single
          aligned unit — every row's columns stay lined up with the header
          above — instead of each row's grid squeezing independently. */}
      <div className="compare-scroll" style={{ overflowX: "auto" }}>
      <div className="compare-inner" style={{ minWidth: 180 + candidates.length * 150 }}>

      {/* CANDIDATE TABS — 14px horizontal padding matches the At a Glance /
          Personal Data / Campaign Platform cards below, so every row's grid
          columns start at the same x-position and line up with the header
          instead of drifting further off with each column. */}
      <div className="compare-grid" style={{ display: "grid", gridTemplateColumns: cols(candidates.length), gap: 0, marginBottom: 4, padding: "0 14px" }}>
        <div />
        {candidates.map((c) => (
          <div key={c.slug} style={{ padding: "0 3px" }}>
            <CandidateTab c={c} onOpenProfile={onOpenProfile} primaryNarrowed={primaryNarrowed} />
          </div>
        ))}
      </div>

      {/* AT A GLANCE — financials */}
      <div style={{ background: T.paperRaised, border: `1px solid ${T.line}`, borderTop: "none", padding: "14px 14px 4px", marginBottom: 18 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: T.ink, padding: "0 4px 8px" }}>At a Glance</div>
        <MoneyRow label="Total raised, this cycle" values={candidates.map((c) => ({ value: c.financials?.totalRaised ?? null, party: partyCode(c.party) }))} />
        <MoneyRow label="Total spent, this cycle" values={candidates.map((c) => ({ value: c.financials?.totalSpent ?? null, party: partyCode(c.party) }))} />
        <DetailRow label="Funding sources" candidates={candidates}
          render={(c) => <FundingBreakdown fundingSources={c.financials?.fundingSources} />} />
        <DetailRow label="Attendance this session" candidates={candidates}
          render={(c) => {
            if (c.performance?.attendance) {
              const { attendanceRate, votesCast, votesInSession } = c.performance.attendance;
              const missed = votesInSession - votesCast;
              // Never round up to a clean "100%" when at least one vote was
              // actually missed (e.g. 235/236 rounds to 100 otherwise) —
              // that reads as a contradiction next to "(1 missed)".
              const pct = missed > 0 ? Math.min(99, Math.round(attendanceRate * 100)) : 100;
              return (
                <span>
                  {pct}%
                  {missed > 0 && <span style={{ color: T.inkSoft, fontSize: 11.5 }}> ({missed} missed)</span>}
                </span>
              );
            }
            const text = c.performance ? "Data temporarily unavailable" : "N/A";
            return <span style={{ color: T.inkSoft, fontStyle: "italic" }}>{text}</span>;
          }} />
        <DetailRow label="Bills sponsored / cosponsored" candidates={candidates}
          render={(c) => {
            if (!c.performance) return null;
            const { bills_sponsored, bills_cosponsored, bills_became_law } = c.performance;
            const ratio = bills_sponsored && bills_became_law != null ? Math.round((bills_became_law / bills_sponsored) * 100) : null;
            return (
              <span>
                {bills_sponsored ?? "—"} / {bills_cosponsored ?? "—"}
                {bills_became_law ? (
                  <span style={{ color: T.inkSoft, fontSize: 11.5 }}> ({bills_became_law} became law{ratio !== null ? ` — ${ratio}% of sponsored bills` : ""})</span>
                ) : null}
              </span>
            );
          }}
          emptyText="N/A" />
        <DetailRow label="Committee assignments" candidates={candidates}
          render={(c) => {
            if (!c.performance) return null;
            const committees = c.performance.committees ?? [];
            const leadership = committees.filter((cm) => cm.title && cm.title !== "Member").length;
            return (
              <span>
                {committees.length}
                {leadership > 0 && <span style={{ color: T.inkSoft, fontSize: 11.5 }}> ({leadership} in a leadership role)</span>}
              </span>
            );
          }}
          emptyText="N/A" />
        <DetailRow
          label={<>Voting record<div style={{ fontSize: 10.5, fontWeight: 400, color: T.inkSoft, fontStyle: "italic", marginTop: 2 }}>which party they vote with, based on actual votes</div></>}
          candidates={candidates}
          render={(c) => c.performance?.ideology_score ? (
            <div>
              <IdeologyScale value={c.performance.ideology_score.nominateDim1} />
              <a href={c.performance.ideology_score.sourceUrl} target="_blank" rel="noreferrer noopener" style={{ color: T.inkSoft, fontSize: 11, marginTop: 3, display: "inline-block" }}>
                source <ExternalLink size={10} style={{ verticalAlign: "middle" }} />
              </a>
            </div>
          ) : null}
          emptyText="N/A" />
        <DetailRow
          label={<>Bipartisanship<div style={{ fontSize: 10.5, fontWeight: 400, color: T.inkSoft, fontStyle: "italic", marginTop: 2 }}>collaborates across party lines vs. votes/speaks along party lines</div></>}
          candidates={candidates}
          render={(c) => c.performance?.bridge_score ? (
            <div>
              <span style={{ fontSize: 18, fontWeight: 700, color: T.ink }}>{c.performance.bridge_score.grade}</span>
              <span style={{ color: T.inkSoft, fontSize: 12 }}> ({c.performance.bridge_score.score.toFixed(1)}/100)</span>
              <div>
                <a href={c.performance.bridge_score.profileUrl} target="_blank" rel="noreferrer noopener" style={{ color: T.inkSoft, fontSize: 11, marginTop: 2, display: "inline-block" }}>
                  source <ExternalLink size={10} style={{ verticalAlign: "middle" }} />
                </a>
              </div>
            </div>
          ) : null}
          emptyText="N/A" />
      </div>
      <div style={{ fontSize: 11, color: T.inkSoft, marginTop: -12, marginBottom: 18, padding: "0 4px", fontStyle: "italic" }}>
        Voting record score: not self-reported or a label we assigned — calculated purely from every vote cast in Congress. Researchers compare how each member votes against every other member on the same bills; members who consistently vote together end up close together on the scale, from -1 (most consistently Democratic voting record) to +1 (most consistently Republican voting record). Method: DW-NOMINATE, in use by political scientists since the 1980s, computed independently by Voteview.com (UCLA) — not calculated or adjusted by Ballot-Wise.
        <br /><br />
        Bipartisanship grade: an independent, published methodology (bridgegrades.org) blending cross-partisan bill sponsorship/co-sponsorship, Problem Solvers Caucus membership, and bipartisan-rhetoric analysis into a single 0–100 score and A–F grade — not calculated or adjusted by Ballot-Wise. Not the same measure as the voting-record scale above: that measures which party a member votes with; this measures how much they work across party lines regardless of which side they usually vote with.
      </div>

      {/* PERSONAL DATA */}
      <div style={{ background: T.paperRaised, border: `1px solid ${T.line}`, borderRadius: 6, padding: "10px 14px 4px", marginBottom: 18 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: T.ink, padding: "0 4px 4px" }}>Personal Data</div>
        <DetailRow label="Background Summary" candidates={candidates} render={(c) => c.bio_summary ? <SourcedField field={c.bio_summary} maxLen={320} /> : null} />
        <DetailRow label="Born in" candidates={candidates} render={(c) => c.bio?.birthplace ? <SourcedField field={c.bio.birthplace} /> : null} />
        <DetailRow label="Marital status" candidates={candidates} render={(c) => c.bio?.marital_status ? <SourcedField field={c.bio.marital_status} /> : null} />
        <DetailRow label="College" candidates={candidates} render={(c) => c.bio?.college ? <SourcedField field={c.bio.college} /> : null} />
        <DetailRow label="Employment record" candidates={candidates} render={(c) => c.bio?.employment_record ? <SourcedField field={c.bio.employment_record} maxLen={70} /> : null} />
        <DetailRow label="Civic affiliations" candidates={candidates} render={(c) => c.bio?.civic_affiliations ? <SourcedField field={c.bio.civic_affiliations} maxLen={70} /> : null} />
        <DetailRow label="Financial disclosure" candidates={candidates} render={(c) => <FinancialDisclosureField fd={c.financial_disclosure} />} />
      </div>

      {/* CAMPAIGN PLATFORM */}
      <div style={{ background: T.paperRaised, border: `1px solid ${T.line}`, borderRadius: 6, padding: "10px 14px 4px", marginBottom: 18 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: T.ink, padding: "0 4px 4px" }}>Campaign Platform</div>
        <DetailRow label="Stated positions" candidates={candidates}
          render={(c) => c.platform?.length ? (
            <div>
              <span>{c.platform.map((p) => p.topic).join(", ")}</span>
              {c.platform_source_url && (
                <a href={c.platform_source_url} target="_blank" rel="noreferrer noopener" style={{ color: T.inkSoft, fontSize: 11, marginTop: 3, marginLeft: 6, display: "inline-block" }}>
                  source <ExternalLink size={10} style={{ verticalAlign: "middle" }} />
                </a>
              )}
            </div>
          ) : null}
          emptyText="No public record found" />
        <DetailRow label="Campaign video" candidates={candidates}
          render={(c) => (c.platform_video_url && youTubeEmbedUrl(c.platform_video_url)) ? (
            <div>
              <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 4 }}>
                {truncateText(c.platform_video_title || "Campaign video", 50)}
                {c.platform_video_tier === 2 && <span style={{ fontStyle: "italic" }}> (found via search, not linked from their site)</span>}
              </div>
              {/* Embedded, not linked: youtube-nocookie.com/embed only renders
                  correctly inside a real iframe — loaded as a bare page (what
                  a target="_blank" link would do) it fails with YouTube's own
                  "Error 153: Video player configuration error". */}
              <iframe
                src={youTubeEmbedUrl(c.platform_video_url)}
                title={c.platform_video_title || "Campaign video"}
                style={{ display: "block", width: "100%", maxWidth: 220, aspectRatio: "16 / 9", border: "none", borderRadius: 4 }}
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
              />
            </div>
          ) : null}
          emptyText="No public record found" />
      </div>

      </div>
      </div>
      <div style={{ fontSize: 11, color: T.inkSoft, marginTop: -12, marginBottom: 18, padding: "0 4px", fontStyle: "italic" }}>
        Quoted directly from each candidate's own campaign site — presented as-is, not evaluated or characterized by Ballot-Wise. Click "Full profile" on a candidate for the full statement and exact quote behind each position.
      </div>

      <EarlyStageSection candidates={earlyStage} onOpenProfile={onOpenProfile} />

      <HardMetricsSection hardMetrics={race?.hard_metrics} stateCode={race?.state} />

      <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 4, lineHeight: 1.5, borderTop: `1px dashed ${T.line}`, paddingTop: 12 }}>
        Every populated field traces to a public source — linked next to the value. This view is a high-level comparison; click "Full profile" on a candidate for their complete voting record, committee list, and legislative activity.
      </div>

      <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <ShareButton />
          <PrintButton />
        </div>
        <ReportIssueLink context={`Race: ${race?.state ?? ""} ${chamber === "senate" ? "Senate" : "House"}\nURL: ${typeof window !== "undefined" ? window.location.href : ""}`} />
      </div>
    </>
  );
}

/* ---------------------------------------------------------
   INDIVIDUAL CANDIDATE VIEW — performance + biography detail.
--------------------------------------------------------- */
function CandidateProfileView({ candidate, race, onBack }) {
  const party = partyCode(candidate.party);
  const perf = candidate.performance;
  return (
    <>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: T.gold, fontSize: 13, cursor: "pointer", fontWeight: 600, marginBottom: 16, padding: 0 }}>
        <ArrowLeft size={15} /> Back to comparison
      </button>

      <VotingSystemNote votingSystem={race?.voting_system} />
      <StateBackgroundCheckBanner field={race?.state_background_check} />

      <div style={{ background: partySoft(party), borderTop: `4px solid ${partyColor(party)}`, borderRadius: 6, padding: "20px 18px", marginBottom: 22 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: partyColor(party), fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>
          {partyLabel(candidate.party)}{candidate.incumbent ? " · Incumbent" : ""}
        </div>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 600, color: T.ink, marginTop: 4 }}>
          {toTitleCase(candidate.full_name)}
        </div>
        {candidate.fec_status === "N" && !race?.primary_results && (
          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 6, fontStyle: "italic" }}>
            Declared candidate — filed a Statement of Candidacy with the FEC but hasn't yet crossed the $5,000 raised/spent threshold for established-filer status.
          </div>
        )}
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
                {perf.attendance ? (() => {
                  const { attendanceRate, votesCast, votesInSession } = perf.attendance;
                  const missed = votesInSession - votesCast;
                  // Same rounding-contradiction guard as the comparison view:
                  // don't show "100%" alongside a nonzero missed count.
                  const pct = missed > 0 ? Math.min(99, Math.round(attendanceRate * 100)) : 100;
                  return (
                    <><strong>{pct}%</strong>{" "}
                    <span style={{ color: T.inkSoft }}>
                      ({votesCast} of {votesInSession} roll calls
                      {missed > 0 && `, ${missed} missed`})
                    </span></>
                  );
                })() : "Not on file"}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", padding: "9px 0", borderTop: `1px dashed ${T.line}` }}>
              <div style={{ fontSize: 12.5, color: T.inkSoft }}>Bills sponsored / cosponsored</div>
              <div style={{ fontSize: 13, color: T.ink }}>{perf.bills_sponsored ?? "—"} / {perf.bills_cosponsored ?? "—"}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", padding: "9px 0", borderTop: `1px dashed ${T.line}` }}>
              <div style={{ fontSize: 12.5, color: T.inkSoft }}>Sponsored bills that became law</div>
              <div style={{ fontSize: 13, color: T.ink }}>
                {perf.bills_became_law ?? "Not on file"}
                {perf.bills_became_law && perf.bills_sponsored ? (
                  <span style={{ color: T.inkSoft }}> — {Math.round((perf.bills_became_law / perf.bills_sponsored) * 100)}% of bills they sponsored</span>
                ) : null}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", padding: "9px 0", borderTop: `1px dashed ${T.line}` }}>
              <div style={{ fontSize: 12.5, color: T.inkSoft, paddingTop: 2 }}>Committee assignments</div>
              <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.7 }}>
                {perf.committees?.length ? perf.committees.map((cm, i) => (
                  <div key={i}>
                    {cm.committee}
                    {cm.title && cm.title !== "Member" && <strong style={{ color: T.gold }}> — {cm.title}</strong>}
                  </div>
                )) : "None on file"}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", padding: "9px 0", borderTop: `1px dashed ${T.line}` }}>
              <div style={{ fontSize: 12.5, color: T.inkSoft }}>
                Voting record
                <div style={{ fontSize: 10.5, fontStyle: "italic", marginTop: 2 }}>which party they vote with, based on actual votes</div>
              </div>
              <div style={{ fontSize: 13, color: T.ink }}>
                {perf.ideology_score ? (
                  <>
                    <IdeologyScale value={perf.ideology_score.nominateDim1} width={200} />
                    <a href={perf.ideology_score.sourceUrl} target="_blank" rel="noreferrer noopener" style={{ color: T.inkSoft, fontSize: 11, marginTop: 4, display: "inline-block" }}>
                      score: {perf.ideology_score.nominateDim1.toFixed(3)} (Voteview.com) <ExternalLink size={10} style={{ verticalAlign: "middle" }} />
                    </a>
                    <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 6, fontStyle: "italic", maxWidth: 480 }}>
                      Not self-reported or a label we assigned — calculated purely from every vote cast in the {perf.ideology_score.congress}th Congress. Researchers compare how each member votes against every other member on the same bills; members who consistently vote together end up close together on the scale. The center isn't "moderate" or "ideal" in any judged sense — it's simply the statistical midpoint between how the two parties typically vote; a member there has a voting record that doesn't consistently track either party's usual pattern. Method: DW-NOMINATE, computed independently by Voteview.com (UCLA), not by Ballot-Wise.
                    </div>
                  </>
                ) : "Not on file"}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", padding: "9px 0", borderTop: `1px dashed ${T.line}` }}>
              <div style={{ fontSize: 12.5, color: T.inkSoft }}>
                Bipartisanship
                <div style={{ fontSize: 10.5, fontStyle: "italic", marginTop: 2 }}>collaborates across party lines vs. votes/speaks along party lines</div>
              </div>
              <div style={{ fontSize: 13, color: T.ink }}>
                {perf.bridge_score ? (
                  <>
                    <span style={{ fontSize: 20, fontWeight: 700 }}>{perf.bridge_score.grade}</span>
                    <span style={{ color: T.inkSoft }}> ({perf.bridge_score.score.toFixed(1)}/100)</span>{" "}
                    <a href={perf.bridge_score.profileUrl} target="_blank" rel="noreferrer noopener" style={{ color: T.gold }}>
                      Bridge Grades <ExternalLink size={11} style={{ verticalAlign: "middle" }} />
                    </a>
                    <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 6, fontStyle: "italic", maxWidth: 480 }}>
                      An independent, published methodology (bridgegrades.org, snapshot {perf.bridge_score.snapshotDate}) blending cross-partisan bill sponsorship/co-sponsorship, Problem Solvers Caucus membership, and bipartisan-rhetoric analysis into one 0–100 score — not calculated or adjusted by Ballot-Wise. Different from the voting-record scale above: that measures which party a member votes with; this measures how much they work across party lines regardless of which side they usually vote with.
                    </div>
                  </>
                ) : "Not on file"}
              </div>
            </div>
          </>
        )}
      </div>

      <div style={{ background: T.paperRaised, border: `1px solid ${T.line}`, borderRadius: 6, padding: "10px 14px", marginBottom: 18 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: T.ink, padding: "6px 4px" }}>Personal Data</div>
        <div style={{ padding: "9px 0", borderTop: `1px dashed ${T.line}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr" }}>
            <div style={{ fontSize: 12.5, color: T.inkSoft }}>Background Summary</div>
            <div style={{ fontSize: 13, color: T.ink }}><SourcedField field={candidate.bio_summary} /></div>
          </div>
        </div>
        {["birthplace", "college", "marital_status", "employment_record", "civic_affiliations"].map((key) => {
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
        <div style={{ padding: "9px 0", borderTop: `1px dashed ${T.line}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr" }}>
            <div style={{ fontSize: 12.5, color: T.inkSoft }}>Financial disclosure</div>
            <div style={{ fontSize: 13, color: T.ink }}>
              {candidate.financial_disclosure ? (
                <>
                  {[
                    ["Reportable assets", candidate.financial_disclosure.hasReportableAssets],
                    ["Earned income", candidate.financial_disclosure.hasEarnedIncome],
                    ["Reportable liabilities", candidate.financial_disclosure.hasReportableLiabilities],
                    ["Outside positions", candidate.financial_disclosure.hasReportablePositions],
                    ["Outside agreements", candidate.financial_disclosure.hasOutsideAgreements],
                    ["Compensation over $5,000/source", candidate.financial_disclosure.hasLargeCompensation],
                  ].map(([label, val]) => (
                    <div key={label}>
                      {label}: <strong>{val === true ? "Yes" : val === false ? "No" : "Not stated"}</strong>
                    </div>
                  ))}
                  <div style={{ marginTop: 4 }}>
                    <a href={candidate.financial_disclosure.pdfUrl} target="_blank" rel="noreferrer noopener" style={{ color: T.gold }}>
                      Filed {candidate.financial_disclosure.filingDate} — view full filing <ExternalLink size={11} style={{ verticalAlign: "middle" }} />
                    </a>
                  </div>
                  <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 4, fontStyle: "italic" }}>
                    Per federal disclosure law, filings report value ranges only, never exact dollar amounts.
                  </div>
                </>
              ) : (
                <span style={{ color: T.inkSoft, fontStyle: "italic" }}>No public record found</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: T.paperRaised, border: `1px solid ${T.line}`, borderRadius: 6, padding: "10px 14px", marginBottom: 18 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: T.ink, padding: "6px 4px" }}>Campaign Platform</div>
        {candidate.platform?.length ? (
          <>
            {candidate.platform.map((p, i) => (
              <div key={i} style={{ padding: "9px 4px", borderTop: i > 0 ? `1px dashed ${T.line}` : "none" }}>
                <div style={{ fontSize: 13, color: T.ink, fontWeight: 600 }}>{p.topic}</div>
                <div style={{ fontSize: 13, color: T.ink, marginTop: 2 }}>{p.value}</div>
                <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4, fontStyle: "italic", borderLeft: `2px solid ${T.line}`, paddingLeft: 8 }}>
                  "{p.snippet}"
                </div>
              </div>
            ))}
            {candidate.platform_source_url && (
              <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 8, padding: "0 4px" }}>
                Quoted directly from{" "}
                <a href={candidate.platform_source_url} target="_blank" rel="noreferrer noopener" style={{ color: T.gold }}>
                  the candidate's own campaign site <ExternalLink size={10} style={{ verticalAlign: "middle" }} />
                </a>
                {" "}— presented as-is, not evaluated or characterized by Ballot-Wise.
              </div>
            )}
          </>
        ) : !candidate.platform_video_url ? (
          <div style={{ fontSize: 13, color: T.inkSoft, fontStyle: "italic", padding: "9px 4px" }}>No public record found.</div>
        ) : null}
        {candidate.platform_video_url && (
          <div style={{ padding: "9px 4px", borderTop: candidate.platform?.length ? `1px dashed ${T.line}` : "none" }}>
            <div style={{ fontSize: 12.5, color: T.inkSoft }}>Campaign video</div>
            <div style={{ fontSize: 13, color: T.ink, fontWeight: 600, marginTop: 4, marginBottom: 6 }}>
              {candidate.platform_video_title || "Campaign video"}
            </div>
            {youTubeEmbedUrl(candidate.platform_video_url) && (
              <div style={{ maxWidth: 400 }}>
                <iframe
                  src={youTubeEmbedUrl(candidate.platform_video_url)}
                  title={candidate.platform_video_title || "Campaign video"}
                  style={{ display: "block", width: "100%", aspectRatio: "16 / 9", border: "none", borderRadius: 4 }}
                  allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            )}
            {candidate.platform_video_source_url ? (
              <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 4 }}>
                Linked from{" "}
                <a href={candidate.platform_video_source_url} target="_blank" rel="noreferrer noopener" style={{ color: T.inkSoft }}>
                  the candidate's own campaign site <ExternalLink size={10} style={{ verticalAlign: "middle" }} />
                </a>
              </div>
            ) : candidate.platform_video_tier === 2 ? (
              <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 4, fontStyle: "italic" }}>
                Found via YouTube search — not linked from the candidate's own site.
              </div>
            ) : null}
          </div>
        )}
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
                <a href={v.sourceUrl} target="_blank" rel="noreferrer noopener" style={{ color: T.gold }}>source</a>
              </div>
            </div>
          ))
        )}
      </div>

      {candidate.performance?.enacted_laws?.length > 0 && (
        <div style={{ background: T.paperRaised, border: `1px solid ${T.line}`, borderRadius: 6, padding: "10px 14px", marginBottom: 18 }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: T.ink, padding: "6px 4px" }}>
            Bills Sponsored That Became Law
          </div>
          {candidate.performance.enacted_laws.map((law, i) => (
            <div key={i} style={{ padding: "10px 4px", borderTop: i > 0 ? `1px dashed ${T.line}` : "none" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, lineHeight: 1.4 }}>{law.title}</div>
              <div style={{ fontSize: 11, color: T.inkSoft, margin: "2px 0 6px" }}>
                {law.billType} {law.billNumber} · Public Law {law.publicLawNumber}
              </div>
              {law.summary && <div style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.5 }}>{law.summary}</div>}
              <a href={law.govinfoUrl} target="_blank" rel="noreferrer noopener" style={{ fontSize: 11.5, color: T.gold, marginTop: 4, display: "inline-block" }}>
                Official text on GovInfo
              </a>
            </div>
          ))}
        </div>
      )}

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
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", padding: "9px 0", borderTop: `1px dashed ${T.line}` }}>
          <div style={{ fontSize: 12.5, color: T.inkSoft }}>Funding sources</div>
          <div style={{ fontSize: 13, color: T.ink }}>
            {fundingSummary(candidate.financials?.fundingSources) ?? "Not on file"}
          </div>
        </div>
      </div>

      <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <ShareButton />
          <PrintButton />
        </div>
        <ReportIssueLink context={`Candidate: ${candidate.full_name}\nRace: ${race?.state ?? ""}\nURL: ${typeof window !== "undefined" ? window.location.href : ""}`} />
      </div>
    </>
  );
}

// Logo lockup styled to echo the ballot-wise.com marketing site's wordmark
// (bold slab "BALLOT" — em dash — lighter serif "WISE") using the same
// Fraunces family already loaded for headlines elsewhere, rather than
// pulling in a second display font just for this.
function Wordmark({ dark }) {
  const ink = dark ? D.ink : T.ink;
  return (
    <span style={{ fontFamily: "'Fraunces', serif", fontSize: 22, letterSpacing: "0.01em" }}>
      <span style={{ fontWeight: 700, color: ink }}>BALLOT</span>
      <span style={{ fontWeight: 400, color: dark ? D.accent : T.gold }}>—</span>
      <span style={{ fontWeight: 500, fontStyle: "italic", color: ink }}>Wise</span>
    </span>
  );
}

const HOW_IT_WORKS = [
  { n: "01", title: "We collect public data", body: "Voting records, campaign finance disclosures, committee assignments, public statements, and legislative history — all from official public sources." },
  { n: "02", title: "We present it clearly", body: "No spin, no editorial slant. We organize the facts into a consistent format so you can compare any two candidates side by side." },
  { n: "03", title: "You vote with confidence", body: "Walk into the voting booth knowing exactly who you're voting for — and why. Your vote, your judgment, your democracy." },
];

const HERO_STATS = [
  { value: "535", label: "Congressional seats" },
  { value: "435", label: "House races every 2 years" },
  { value: "100", label: "Senate seats" },
  { value: "$0", label: "Known dollars that compromise our non-partisan commitment" },
];

// Mapbox's Search Box API, called directly from the browser with a public,
// domain-restricted token (Mapbox's own recommended pattern — no backend
// proxy needed, unlike the Census geocoder, which has no CORS headers at
// all). Silently degrades to a plain text input if VITE_MAPBOX_TOKEN isn't
// configured, rather than breaking the page — this is a convenience layer
// in front of geocodeAddress()/Census, which stays the actual source of
// truth for the district match either way.
//
// One session_token (a v4 UUID) is reused across every /suggest call for a
// single search interaction, then rotated after a selection — this is what
// makes Mapbox bill the whole interaction as one session instead of per
// keystroke. No /retrieve call: /suggest's own `full_address` field is
// already a complete, resubmittable address string, and Census — not
// Mapbox — is what actually needs to resolve it precisely.
function AddressAutocomplete({ value, onChange, onSearch, placeholder, colors }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const sessionTokenRef = useRef(crypto.randomUUID());
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = (query) => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token || query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const params = new URLSearchParams({
      q: query,
      access_token: token,
      session_token: sessionTokenRef.current,
      country: "US",
      types: "address",
      language: "en",
      limit: "5",
    });
    fetch(`https://api.mapbox.com/search/searchbox/v1/suggest?${params}`)
      .then((r) => (r.ok ? r.json() : { suggestions: [] }))
      .then((data) => {
        setSuggestions(data.suggestions || []);
        setOpen((data.suggestions || []).length > 0);
        setHighlightIndex(-1);
      })
      .catch(() => setSuggestions([]));
  };

  const handleChange = (e) => {
    const v = e.target.value;
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 250);
  };

  const selectSuggestion = (s) => {
    const full = s.full_address || s.name;
    onChange(full);
    setSuggestions([]);
    setOpen(false);
    sessionTokenRef.current = crypto.randomUUID(); // next search starts a fresh billing session
    onSearch(full);
  };

  const handleKeyDown = (e) => {
    if (open && suggestions.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && highlightIndex >= 0) {
        e.preventDefault();
        selectSuggestion(suggestions[highlightIndex]);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
    }
    if (e.key === "Enter") onSearch();
  };

  return (
    <div ref={containerRef} style={{ position: "relative", flex: "1 1 280px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "10px 14px" }}>
        <MapPin size={16} color={colors.inkSoft} />
        <input
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          style={{ border: "none", background: "transparent", fontSize: 14, width: "100%", color: colors.ink }}
        />
      </div>
      {open && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: colors.bg,
            border: `1px solid ${colors.border}`,
            borderRadius: 6,
            zIndex: 20,
            overflow: "hidden",
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          }}
        >
          {suggestions.map((s, i) => (
            <div
              key={s.mapbox_id}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus on the input rather than blurring before onClick fires
                selectSuggestion(s);
              }}
              onMouseEnter={() => setHighlightIndex(i)}
              style={{
                padding: "9px 14px",
                fontSize: 13.5,
                cursor: "pointer",
                background: i === highlightIndex ? colors.border : "transparent",
                color: colors.ink,
              }}
            >
              {s.full_address || s.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LandingHero({ address, setAddress, handleSearch, status, onShowAbout }) {
  return (
    <div style={{ background: D.bg, color: D.ink }}>
      <div style={{ borderBottom: `1px solid ${D.line}`, padding: "16px 20px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <Wordmark dark />
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button onClick={onShowAbout} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: D.inkSoft, fontSize: 12, textDecoration: "underline" }}>
              About the data
            </button>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: D.inkSoft }}>
              Non-Partisan · Public Data · No Party Funding
            </span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "56px 20px 40px" }}>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(30px, 5.5vw, 46px)", fontWeight: 600, margin: "0 0 16px", lineHeight: 1.12 }}>
          Your vote in Congress matters more than you think.
        </h1>
        <p style={{ color: D.inkSoft, fontSize: 15.5, lineHeight: 1.6, maxWidth: 560, margin: "0 0 26px" }}>
          The President gets the headlines. But Congress shapes your life. Ballot-Wise gives you clear, fact-based profiles on every congressional candidate — so you can vote with confidence, not confusion.
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <AddressAutocomplete
            value={address}
            onChange={setAddress}
            onSearch={handleSearch}
            placeholder="Street address, city, state, ZIP"
            colors={{ bg: D.bgRaised, border: D.line, ink: D.ink, inkSoft: D.inkSoft }}
          />
          <button
            onClick={handleSearch}
            disabled={status === "loading"}
            style={{ display: "flex", alignItems: "center", gap: 8, background: D.accent, color: D.bg, border: "none", borderRadius: 6, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            <Search size={15} /> {status === "loading" ? "Looking up…" : "Find your candidates"}
          </button>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${D.line}`, borderBottom: `1px solid ${D.line}` }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "22px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 18 }}>
          {HERO_STATS.map((s) => (
            <div key={s.label}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 30, fontWeight: 600, color: D.ink }}>{s.value}</div>
              <div style={{ fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase", color: D.inkSoft, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 20px" }}>
        <p style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontStyle: "italic", lineHeight: 1.45, color: D.ink, margin: "0 0 16px" }}>
          "The only way to make our voices heard and weigh in on Presidential decisions is through our representatives in Congress."
        </p>
        <p style={{ color: D.inkSoft, fontSize: 14.5, lineHeight: 1.6 }}>
          Congress is where real power lives — the power to debate policy, limit or empower the President, create or eliminate laws, audit officials, and allocate budgets. We don't have time to research every candidate; politics isn't our day job. Ballot-Wise collects public information on every congressional candidate and presents it in a way that's easy to compare, easy to understand, and impossible to spin.
        </p>
      </div>

      <div style={{ borderTop: `1px solid ${D.line}` }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px" }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600, marginBottom: 24 }}>How Ballot-Wise works</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 24 }}>
            {HOW_IT_WORKS.map((step) => (
              <div key={step.n}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: D.accent, fontWeight: 700, marginBottom: 8 }}>{step.n}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: D.ink, marginBottom: 6 }}>{step.title}</div>
                <div style={{ fontSize: 13.5, color: D.inkSoft, lineHeight: 1.55 }}>{step.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${D.line}` }}>
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "36px 20px 48px" }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            We don't knowingly take money that compromises our non-partisan commitment to the community. Just the facts.
          </div>
          <p style={{ color: D.inkSoft, fontSize: 13.5, lineHeight: 1.6 }}>
            Ballot-Wise's policy is to be funded by citizens, not campaigns — we do not knowingly accept contributions from candidates, political parties, PACs, or lobbying organizations. Our only obligation is to you. Every fact shown traces to a public source, linked next to the value — nothing here is summarized from memory or characterized on our behalf.
          </p>
        </div>
      </div>
    </div>
  );
}

// Escape hatch shown alongside any lookup error: bypasses geocoding
// entirely for a voter who already knows their district (from their county
// board of elections, state Secretary of State site, or voter registration
// card) — most useful for the redistricting-uncertain case above, where
// address lookup can't resolve a precise district at all.
function DistrictEntryFallback({ onSubmit, exampleState }) {
  const [value, setValue] = useState("");
  const [parseError, setParseError] = useState("");
  // Example uses the voter's OWN state when we know it (the redistricting-
  // uncertain case), so it reads as "fill in your number" rather than a
  // fixed state that looks like a literal instruction. Falls back to a
  // generic pair of examples for any other error, where no state is known.
  const ex = exampleState || "NC";
  const example = `${ex}-04 or ${ex}-AL`;

  const submit = () => {
    const parsed = parseDistrictInput(value);
    if (!parsed) {
      setParseError(`Couldn't read that — try a format like ${example}.`);
      return;
    }
    setParseError("");
    onSubmit(parsed.stusab, parsed.districtCode);
  };

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.warn}` }}>
      <div style={{ fontSize: 12.5, color: T.inkSoft, marginBottom: 6 }}>
        Know your district already? Enter it as your state's postal abbreviation plus the district number (e.g. {example} for an at-large state) to see your candidates:
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={example}
          style={{ border: `1px solid ${T.line}`, background: T.paperRaised, borderRadius: 6, padding: "8px 10px", fontSize: 13.5, color: T.ink, width: 160 }}
        />
        <button
          onClick={submit}
          style={{ background: T.ink, color: T.paper, border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
        >
          Find my candidates
        </button>
      </div>
      {parseError && <div style={{ fontSize: 12, color: T.warn, marginTop: 6 }}>{parseError}</div>}
    </div>
  );
}

// A mailto: link rather than a form + backend endpoint -- this is a static
// site with no server beyond one geocoding Function, and shipping a real
// feedback channel today (even a slightly clunkier one) matters more than
// building server-side form handling before knowing whether reports are
// common enough to justify it. `context` is prefilled into the email body
// so a report always identifies exactly what page/candidate it's about,
// even if the reporter doesn't say much else.
function ReportIssueLink({ context, label = "Report an issue with this data" }) {
  const subject = encodeURIComponent("Ballot-Wise: possible data issue");
  const body = encodeURIComponent(`${context}\n\nWhat looks wrong:\n(describe here)\n`);
  return (
    <a
      href={`mailto:floridagsf@gmail.com?subject=${subject}&body=${body}`}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, color: T.inkSoft, fontSize: 12, textDecoration: "none" }}
    >
      <Flag size={12} /> {label}
    </a>
  );
}

// Copies the current URL (already kept in sync with the active race/profile
// via history.pushState) rather than constructing one -- confirms to the
// user that what they're sharing is exactly what they're looking at.
function ShareButton() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (older browser, non-HTTPS, denied
      // permission) -- fails silently rather than showing a broken button,
      // same "don't claim something happened that didn't" standard as
      // every data field on this site.
    }
  };
  return (
    <button
      onClick={copy}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: `1px solid ${T.line}`, borderRadius: 6, padding: "6px 10px", fontSize: 12, color: T.inkSoft, cursor: "pointer" }}
    >
      <Link2 size={12} /> {copied ? "Link copied" : "Share this comparison"}
    </button>
  );
}

function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: `1px solid ${T.line}`, borderRadius: 6, padding: "6px 10px", fontSize: 12, color: T.inkSoft, cursor: "pointer" }}
    >
      <Printer size={12} /> Print
    </button>
  );
}

const DATA_SOURCES = [
  ["Candidate registration & fundraising", "Federal Election Commission (FEC)"],
  ["Voting record, committees, bills, attendance", "Congress.gov & the U.S. House Clerk"],
  ["Voting-record ideology score", "VoteView.com (UCLA), DW-NOMINATE method"],
  ["Bipartisanship grade", "Bridge Grades (bridgegrades.org), an independent published methodology"],
  ["Background, platform, campaign video", "Each candidate's own campaign website, quoted verbatim"],
  ["Biographical facts not on a campaign site", "House Historian, Wikipedia/Wikidata, Ballotpedia"],
  ["Financial disclosure", "U.S. House Clerk's public financial disclosure filings"],
  ["State population, income, jobs, crime", "U.S. Census Bureau, BLS, FBI Crime Data Explorer"],
  ["Primary-election results", "Each state's official election results, or AP/Ballotpedia reporting of them"],
];

// A dedicated overlay rather than a routed page -- this content never needs
// its own deep link or to interact with the geocoding/race-loading state
// machine, so a modal keeps it simple and avoids touching that logic at all.
function AboutModal({ onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(23,20,15,0.55)", zIndex: 50, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: T.paper, borderRadius: 10, maxWidth: 640, width: "100%", padding: "28px 28px 24px", position: "relative" }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: "absolute", top: 18, right: 18, background: "transparent", border: "none", cursor: "pointer", color: T.inkSoft }}
        >
          <X size={20} />
        </button>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 600, marginBottom: 6 }}>About the data</div>
        <p style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.6, marginBottom: 20 }}>
          Every fact on Ballot-Wise traces to a public source, linked directly next to the value. Nothing is summarized from memory, inferred, or characterized on our behalf — if we can't verbatim-quote a source for a fact, we show "No public record found" instead of guessing.
        </p>

        <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: T.inkSoft, marginBottom: 10 }}>Where each type of fact comes from</div>
        <div style={{ marginBottom: 20 }}>
          {DATA_SOURCES.map(([label, source]) => (
            <div key={label} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "7px 0", borderTop: `1px dashed ${T.line}`, fontSize: 12.5 }}>
              <div style={{ color: T.ink }}>{label}</div>
              <div style={{ color: T.inkSoft }}>{source}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: T.inkSoft, marginBottom: 8 }}>Why some fields are empty</div>
        <p style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.6, marginBottom: 20 }}>
          All data shown here comes from public and official records. Some information we believe the public deserves isn't required to be disclosed — it takes the candidate's own authorization to release (things like high school, college, financial statements, or exact date of birth). Ballot-Wise searches every source we believe is trustworthy and verifiable, but we won't guess, and we won't publish anything we can't cite. Even when a candidate is under no legal obligation to share something, we believe they should, as a commitment to the public — we can't choose the best person for Congress if we don't know their whole story. If a candidate's profile is missing something you're looking for, call their office and ask them to release it. Ballot-Wise is meant to be a tool for you to take control of your own decision — not the other way around.
        </p>

        <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: T.inkSoft, marginBottom: 8 }}>How current is this?</div>
        <p style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.6, marginBottom: 20 }}>
          Candidate data refreshes on an ongoing basis throughout the election cycle. Once a state's primary is certified, the general-election field is narrowed to the confirmed nominees, cited on that race's page.
        </p>

        <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: T.inkSoft, marginBottom: 8 }}>Funding</div>
        <p style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.6, marginBottom: 20 }}>
          Ballot-Wise's policy is to be funded by citizens, not campaigns — we do not knowingly accept contributions from candidates, political parties, PACs, or lobbying organizations.
        </p>

        <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 16 }}>
          <ReportIssueLink context="General question or feedback about Ballot-Wise's data." label="See something wrong? Report it" />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [error, setError] = useState("");
  const [errorExampleState, setErrorExampleState] = useState(null);
  const [geo, setGeo] = useState(null);
  const [chamber, setChamber] = useState("house");
  const [houseRace, setHouseRace] = useState(null);
  const [senateRace, setSenateRace] = useState(null);
  const [profileSlug, setProfileSlug] = useState(null);
  const [showAbout, setShowAbout] = useState(false);

  // Shared by both entry points below: geocodeAddress and the direct-district
  // fallback each resolve a { stusab, districtCode, ... } differently, but
  // loading and displaying the actual races is identical either way.
  // `push: false` is for restoring FROM the URL (initial mount, popstate) —
  // syncing state to match history that already exists, not creating a new
  // entry on top of it.
  const loadRacesForGeo = async (resolvedGeo, opts = {}) => {
    const { push = true, chamber: requestedChamber, profileSlug: requestedProfileSlug = null } = opts;
    setGeo(resolvedGeo);
    const [house, senate] = await Promise.all([
      fetchRace("house", resolvedGeo.stusab, resolvedGeo.districtCode),
      fetchRace("senate", resolvedGeo.stusab, resolvedGeo.districtCode),
    ]);
    setHouseRace(house);
    setSenateRace(senate);
    const resolvedChamber =
      requestedChamber === "senate" && senate ? "senate" :
      requestedChamber === "house" && house ? "house" :
      house ? "house" : "senate";
    setChamber(resolvedChamber);
    setProfileSlug(requestedProfileSlug);
    setStatus("ready");
    const urlState = { stusab: resolvedGeo.stusab, districtCode: resolvedGeo.districtCode, chamber: resolvedChamber, profile: requestedProfileSlug };
    const url = buildAppUrl(urlState);
    if (push) history.pushState(urlState, "", url);
    else history.replaceState(urlState, "", url);
  };

  // addressOverride lets a freshly-picked autocomplete suggestion trigger a
  // search immediately, instead of waiting a render cycle for the setAddress
  // state update to land (setAddress + reading `address` in the same tick
  // would still see the old value).
  const handleSearch = async (addressOverride) => {
    // typeof-checked, not just ??-defaulted: onClick={handleSearch} on the
    // submit buttons passes the click SyntheticEvent as this same first
    // argument, and an event object is neither null nor undefined, so ??
    // alone would use it as the address and crash on .trim().
    const addr = typeof addressOverride === "string" ? addressOverride : address;
    if (!addr.trim() || status === "loading") return;
    setStatus("loading");
    setError("");
    setErrorExampleState(null);
    setProfileSlug(null);
    try {
      await loadRacesForGeo(await geocodeAddress(addr));
    } catch (err) {
      setError(err.message || "Something went wrong looking up that address.");
      setErrorExampleState(err.exampleState ?? null);
      setStatus("error");
    }
  };

  // Bypasses geocodeAddress entirely — fetchRace only ever needed
  // stusab/districtCode, so a voter who already knows their district (e.g.
  // from the redistricting-uncertain message above) skips address lookup,
  // and with it the county-level precision limit that message describes.
  const handleDistrictEntry = async (stusab, districtCode) => {
    setStatus("loading");
    setError("");
    setProfileSlug(null);
    try {
      await loadRacesForGeo({
        stusab,
        stateName: STATE_NAMES[stusab] ?? stusab,
        districtCode,
        districtLabel: districtCode === "AL" ? "At-Large" : `District ${districtCode}`,
      });
    } catch (err) {
      setError(err.message || "Something went wrong looking up that district.");
      setErrorExampleState(stusab); // keep the example in the state they just tried, for an easy retry
      setStatus("error");
    }
  };

  const activeRace = chamber === "house" ? houseRace : senateRace;
  const profileCandidate = profileSlug ? activeRace?.candidates.find((c) => c.slug === profileSlug) : null;

  // Syncs React state to whatever the URL currently says — used both on
  // first mount (a deep link, or a reload after leaving the page — see the
  // note above buildAppUrl) and on every popstate (the user pressing the
  // real back/forward button). Reuses already-loaded race data when it's
  // for the same district instead of re-fetching, so pressing back to close
  // a profile is instant rather than a network round trip.
  const restoreFromUrl = async () => {
    const parsed = parseAppUrl(window.location.search);
    if (!parsed) {
      setStatus("idle");
      setProfileSlug(null);
      return;
    }
    if (geo?.stusab === parsed.stusab && geo?.districtCode === parsed.districtCode && (houseRace || senateRace)) {
      if (parsed.chamber === "senate" && senateRace) setChamber("senate");
      else if (parsed.chamber === "house" && houseRace) setChamber("house");
      setProfileSlug(parsed.profile);
      setStatus("ready");
      return;
    }
    setStatus("loading");
    try {
      await loadRacesForGeo(
        {
          stusab: parsed.stusab,
          stateName: STATE_NAMES[parsed.stusab] ?? parsed.stusab,
          districtCode: parsed.districtCode,
          districtLabel: parsed.districtCode === "AL" ? "At-Large" : `District ${parsed.districtCode}`,
        },
        { push: false, chamber: parsed.chamber, profileSlug: parsed.profile }
      );
    } catch {
      // A stale/no-longer-buildable URL shouldn't strand the user on a dead
      // error screen — fall back to the landing page, same as a bare visit.
      setStatus("idle");
    }
  };

  useEffect(() => {
    if (parseAppUrl(window.location.search)) restoreFromUrl();
    // Deliberately mount-only: this restores from whatever URL the page was
    // loaded with, once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onPopState = () => restoreFromUrl();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // Re-subscribes when the in-memory fast path's own inputs change, so the
    // listener never closes over stale geo/houseRace/senateRace values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, houseRace, senateRace]);

  const openProfile = (slug) => {
    setProfileSlug(slug);
    const urlState = { stusab: geo?.stusab, districtCode: geo?.districtCode, chamber, profile: slug };
    history.pushState(urlState, "", buildAppUrl(urlState));
  };

  const closeProfile = () => {
    setProfileSlug(null);
    const urlState = { stusab: geo?.stusab, districtCode: geo?.districtCode, chamber, profile: null };
    history.replaceState(urlState, "", buildAppUrl(urlState));
  };

  const switchChamber = (c) => {
    setChamber(c);
    setProfileSlug(null);
    const urlState = { stusab: geo?.stusab, districtCode: geo?.districtCode, chamber: c, profile: null };
    history.replaceState(urlState, "", buildAppUrl(urlState));
  };

  const goHome = () => {
    setStatus("idle");
    history.pushState(null, "", "/");
  };

  return (
    <div style={{ background: T.paper, minHeight: "100vh", fontFamily: "'IBM Plex Sans', sans-serif", color: T.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
        input:focus, button:focus-visible { outline: 2px solid ${T.gold}; outline-offset: 2px; }
        @media (max-width: 760px) {
          .compare-grid { grid-template-columns: 1fr !important; }
          .compare-inner { min-width: 0 !important; }
        }
        @media print {
          .no-print { display: none !important; }
          iframe { display: none !important; }
          body { background: white !important; }
          a[href]::after { content: none !important; }
        }
      `}</style>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}

      {status === "idle" ? (
        <LandingHero address={address} setAddress={setAddress} handleSearch={handleSearch} status={status} onShowAbout={() => setShowAbout(true)} />
      ) : (
        <>
          <div style={{ borderBottom: `1px solid ${T.line}`, padding: "16px 20px" }}>
            <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <button onClick={goHome} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
                  <Wordmark />
                </button>
                <button
                  onClick={goHome}
                  style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "none", padding: 0, cursor: "pointer", color: T.inkSoft, fontSize: 12.5, fontWeight: 500 }}
                >
                  <ArrowLeft size={13} /> Back to home
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <button onClick={() => setShowAbout(true)} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: T.inkSoft, fontSize: 12, textDecoration: "underline" }}>
                  About the data
                </button>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: T.inkSoft }}>
                  The congressional record, compared
                </span>
              </div>
            </div>
          </div>

          <div className="no-print" style={{ borderBottom: `1px solid ${T.line}`, padding: "20px 20px" }}>
            <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
              <AddressAutocomplete
                value={address}
                onChange={setAddress}
                onSearch={handleSearch}
                placeholder="Street address, city, state, ZIP"
                colors={{ bg: T.paperRaised, border: T.line, ink: T.ink, inkSoft: T.inkSoft }}
              />
              <button
                onClick={handleSearch}
                disabled={status === "loading"}
                style={{ display: "flex", alignItems: "center", gap: 8, background: T.ink, color: T.paper, border: "none", borderRadius: 6, padding: "10px 18px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
              >
                <Search size={15} /> {status === "loading" ? "Looking up…" : "Find my ballot"}
              </button>
            </div>
          </div>
        </>
      )}

      {status === "error" && (
        <div style={{ maxWidth: 760, margin: "20px auto 0", padding: "0 20px" }}>
          <div style={{ background: T.warnSoft, border: `1px solid ${T.warn}`, borderRadius: 6, padding: "12px 14px" }}>
            <div style={{ display: "flex", gap: 10 }}>
              <AlertTriangle size={18} color={T.warn} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13.5, color: T.ink }}>{error}</div>
            </div>
            <DistrictEntryFallback onSubmit={handleDistrictEntry} exampleState={errorExampleState} />
          </div>
        </div>
      )}

      {status === "ready" && (
        <div style={{ maxWidth: 920, margin: "0 auto", padding: "28px 20px 60px" }}>
          {profileCandidate ? (
            <CandidateProfileView candidate={profileCandidate} race={activeRace} onBack={closeProfile} />
          ) : (
            <ComparisonView
              race={activeRace}
              chamber={chamber}
              houseRace={houseRace}
              senateRace={senateRace}
              setChamber={switchChamber}
              geo={geo}
              onOpenProfile={openProfile}
            />
          )}
        </div>
      )}
    </div>
  );
}
