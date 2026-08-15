// Run daily by a scheduled Claude Code task (not GitHub Actions — this
// needs to actually message the user, which a CI job can't do on its
// own). Compares PENDING_RACES against today's date and prints anything
// that should be (re-)surfaced, so the scheduled task can turn that into
// a push notification. The only way an item stops showing up here for
// good is getting removed from PENDING_RACES entirely once its race is
// actually built — same "remove it once it's done" convention as
// RACES[] itself.
//
// Two different re-notify rules, because "due" means something different
// for the two shapes of entry here:
//   - A dated entry (a primary/runoff date) notifies ONCE when its date
//     passes, then stays quiet — the date isn't going to become true
//     again, so repeating the same notification forever would just be
//     noise once the user already knows.
//   - An undated entry (e.g. Washington's still-uncertified districts)
//     has no date to anchor a single trigger to — it represents an
//     ongoing "still not resolved" state, so it re-notifies on a fixed
//     interval (weekly) for as long as it stays in the list, rather than
//     either spamming daily or going silent after the first mention.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PENDING_RACES } from "./pendingRaces.js";

const STATE_PATH = join(import.meta.dirname, "notifiedPending.json");
const UNDATED_RENOTIFY_DAYS = 7;

type NotifiedState = Record<string, string>; // id -> ISO date last notified

function loadNotified(): NotifiedState {
  if (!existsSync(STATE_PATH)) return {};
  try {
    const parsed = JSON.parse(readFileSync(STATE_PATH, "utf-8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveNotified(state: NotifiedState) {
  const sorted: NotifiedState = {};
  for (const id of Object.keys(state).sort()) sorted[id] = state[id];
  writeFileSync(STATE_PATH, JSON.stringify(sorted, null, 2) + "\n");
}

function daysBetween(isoA: string, isoB: string): number {
  return Math.abs(new Date(isoA).getTime() - new Date(isoB).getTime()) / 86_400_000;
}

function main() {
  const today = new Date().toISOString().slice(0, 10);
  const notified = loadNotified();

  // Prune state for entries no longer in PENDING_RACES (built and
  // removed) — keeps the file from accumulating dead IDs forever.
  const currentIds = new Set(PENDING_RACES.map((r) => r.id));
  for (const id of Object.keys(notified)) {
    if (!currentIds.has(id)) delete notified[id];
  }

  const toSurface = PENDING_RACES.filter((r) => {
    const lastNotified = notified[r.id];
    if (r.watchDate) {
      // Dated: surface once, only after the date has passed.
      return r.watchDate <= today && !lastNotified;
    }
    // Undated: surface on first sight, then again every N days while
    // it's still in the list (i.e. still unresolved).
    return !lastNotified || daysBetween(lastNotified, today) >= UNDATED_RENOTIFY_DAYS;
  });

  if (toSurface.length === 0) {
    console.log("NO_NEW_FLAGS");
    saveNotified(notified); // still save in case pruning changed anything
    return;
  }

  console.log(`FLAGS: ${toSurface.length}`);
  for (const r of toSurface) {
    console.log(`- [${r.id}] ${r.description}`);
    console.log(`  watch date: ${r.watchDate ?? "(none — recurring check)"}  reason: ${r.watchReason}`);
    console.log(`  source: ${r.source_url}`);
    notified[r.id] = today;
  }

  saveNotified(notified);
}

main();
