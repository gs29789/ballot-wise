# Ballot-Wise data automation

Two cloud routines keep candidate data current. They're split by cost: one runs automatically because it's free, the other only runs when a human explicitly decides to, because it costs money. Neither ever touches `main` or publishes to production — both hold their findings on a review branch for manual audit first.

Manage both at [claude.ai/code/routines](https://claude.ai/code/routines). Trigger either one from a session with `RemoteTrigger` (`action: "run"`, works even while a routine shows "Paused").

## Process 1 — "Ballot-Wise weekly free refresh"

**Schedule:** every Monday, 9:00 AM GMT-3 (noon UTC). Runs automatically — no human needed.
**Environment:** `ballot-wise-weekly-free` — holds `BLS_API_KEY`, `CENSUS_API_KEY`, `CONGRESS_GOV_API_KEY`, `FEC_API_KEY`, `YOUTUBE_API_KEY` (all free-tier, no billing), plus Custom network access to the ten government/public-data domains those keys talk to.
**Branch:** `data-weekly-review`

Runs three scripts in order, all zero-cost:

1. **`pipeline/src/ci/refreshKnownFacts.ts`** — re-checks already-known candidates' public-record facts: recent votes, bills sponsored/cosponsored, enacted laws, committee assignments, DW-NOMINATE ideology score, Bridge Grades bipartisanship score, FEC fundraising totals, and state-level hard metrics (population, income, unemployment, crime, federal spending). Also scans FEC for brand-new filers on races that haven't had their primary yet — that's the signal for whether Process 2 is worth running. Deliberately does **not** recompute full-session attendance (`getAttendanceStats`) — that walks 250+ individual requests per incumbent and tripped a rate limit on clerk.house.gov during testing, silently writing a wrong (lower) figure. Attendance still refreshes normally whenever the main pipeline rebuilds a race.
2. **`scaleVideoOnly.ts`** — Tier 1 campaign video: finds a video already linked on a candidate's own site. No API key at all, just fetches their page.
3. **`scaleVideoTier2.ts`** — Tier 2 campaign video: YouTube search for candidates with no site-linked video. Uses `YOUTUBE_API_KEY`, free up to Google's daily quota.

**Output:** updated race JSON in `pipeline/build/`, plus `pipeline/build/_weekly_refresh_findings.{json,md}` — a table of everything that changed, split into "needs a decision" (new candidates with no site/bio/platform on file) and "informational" (existing candidates' data updated). Commits + pushes to `data-weekly-review` only if something actually changed. Emails and push-notifies `floridagsf@gmail.com` every run, including "nothing changed this week."

## Process 2 — "Ballot-Wise paid discovery (manual)"

**Schedule:** none, by design. Carries a technically-required `cron_expression` field but stays `enabled: false` permanently — that's what actually prevents it from firing on its own. Trigger it explicitly (UI "Run now", or ask Claude to run it via API) whenever Process 1's findings suggest it's worth doing.
**Environment:** `ballot-wise-paid` — holds `ANTHROPIC_API_KEY` (currently the same key as local pipeline development, not a separate spend-capped one).
**Branch:** `data-paid-review`

Runs one script:

- **`scaleNoSiteBacklog.ts`** — for candidates with no known campaign site, searches for one; if found, extracts bio summary and platform positions from it in the same pass. This is the only paid-tier backlog script that exists today — it covers 3 of the 4 Anthropic-dependent extraction paths in this pipeline (site discovery, bio, platform). **Financial-disclosure re-extraction has no standalone backlog script** — it only runs as part of a full race rebuild (`buildRace()` in `build.ts`). The routine's own email states this every run so it's never mistaken for "already covered."

**Output:** same pattern as Process 1 — updated race JSON, commit+push to `data-paid-review` only if something changed, one email + push notification every run, explicitly marked UNAUDITED.

## Why the split

Two consumers of two different budgets. Process 1's sources are free-tier government APIs with no real cost ceiling to worry about, so it runs on autopilot. Process 2 spends real money per candidate (site-discovery search + bio + platform extraction, all LLM calls) — the same `ANTHROPIC_API_KEY` that ran out of credit balance twice earlier in this project's history. It only runs when a human decides it's worth the spend.

## Audit requirement before publishing anything

Nothing on either review branch is verified. In particular:
- Video finds (both tiers) need an independent oEmbed channel-identity check — Tier 2's first raw audit was 44% wrong, including two live misattributions of third-party news coverage as a candidate's own video.
- Bio/platform finds need the same "no source, no field" verification as everything else on the site — quote-anchored, no summarizing or characterizing beyond what the source actually says.

## Retired

**"Ballot-Wise daily data backlog"** — the original daily routine this replaces. Disabled 2026-08-24. It targeted the same free/paid split but bundled both into one daily job with no environment ever configured, so every run failed silently on missing keys. Its old branch, `data-backlog-review`, is untouched history — nothing new writes to it anymore.

**"Ballot-Wise pending races check"** — unrelated, still active, unaffected by any of this. Daily, read-only, checks `pendingRaces.ts` against real primary dates and emails when one's due for a manual research pass.
