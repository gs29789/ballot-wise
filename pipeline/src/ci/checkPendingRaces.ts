// Run daily by a scheduled Claude Code routine (not GitHub Actions — this
// needs to actually message the user, which a CI job can't do on its own).
// Stateless by design: prints every entry whose watch date (plus a buffer)
// has passed, every single time it runs, with no memory of what it already
// reported. That repetition is intentional, not a bug to dedup away — the
// routine that wraps this script is meant to nag daily until someone
// actually does the research-and-build pass for a race. The only way an
// item stops showing up here is getting removed from PENDING_RACES entirely
// once its race is actually built — same "remove it once it's done"
// convention as RACES[] itself.
//
// BUFFER_DAYS exists because election-results databases don't update the
// instant polls close — a few days' grace avoids nagging about a primary
// before any state has actually posted results for it.
import { PENDING_RACES } from "./pendingRaces.js";

const BUFFER_DAYS = 3;

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function main() {
  const today = new Date().toISOString().slice(0, 10);

  // A dated entry is due once today reaches watchDate + BUFFER_DAYS. An
  // undated entry (e.g. a still-uncertified district) has no date to wait
  // for, so it's due on every run for as long as it stays in the list.
  const due = PENDING_RACES.filter((r) => !r.watchDate || addDays(r.watchDate, BUFFER_DAYS) <= today);

  if (due.length === 0) {
    console.log("NO_NEW_FLAGS");
    return;
  }

  console.log(`FLAGS: ${due.length}`);
  for (const r of due) {
    console.log(`- [${r.id}] ${r.description}`);
    console.log(`  watch date: ${r.watchDate ?? "(none — recurring check)"}  reason: ${r.watchReason}`);
    console.log(`  source: ${r.source_url}`);
  }
}

main();
