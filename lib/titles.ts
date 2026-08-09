/**
 * Builder titles.
 *
 * The obvious move here is mystical noun-pairing — "Async Custodian",
 * "Race Condition Mystic" — which is where the rest of the field landed. But
 * the event's whole voice is "Less Noise. More Signal." and "developers who
 * live in their terminals", so the funnier and more on-brand register is
 * deadpan: describe a habit rather than award a mystique.
 */
const TITLES = [
  "Ships on Fridays",
  "Reads the Stack Trace",
  "Deletes More Than They Write",
  "Keeps the Build Green",
  "Reverts Without Ego",
  "Cuts the Scope",
  "Writes the Migration",
  "Owns the Pager",
  "Measures Before Optimising",
  "Removes the Dependency",
  "Trusts the Types",
  "Leaves It Cleaner",
  "Documents the Why",
  "Ends the Meeting Early",
  "Names Things Properly",
  "Reproduces It First",
  "Finishes the Refactor",
  "Reads the Docs",
  "Answers the Alert",
  "Closes the Tabs",
  "Reviews Before Lunch",
  "Fixes the Flaky Test",
  "Ships the Boring Version",
  "Deploys on a Monday",
  "Writes the Test First",
  "Says No to the Rewrite",
  "Keeps the Diff Small",
  "Debugs at Sunrise",
  "Rebases Cleanly",
  "Reads the Changelog",
  "Turns Off Notifications",
  "Profiles Before Guessing",
  "Handles the Edge Case",
  "Deletes the Dead Code",
  "Ships Without a Demo",
  "Checks the Logs First",
  "Writes It Down",
  "Fixes the Root Cause",
  "Leaves Good Commit Messages",
  "Builds the Small Thing",
];

/** FNV-1a — small, fast, and stable across runs and platforms. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Deterministic from the name so a given person always gets the same title —
 * it stays stable if they tweak their photo, and two people comparing cards
 * see a consistent result rather than something that looks randomised.
 *
 * `salt` backs the reroll button.
 */
export function titleFor(name: string, salt = 0): string {
  const key = name.trim().toLowerCase() || "builder";
  return TITLES[(hash(key) + salt * 2654435761) % TITLES.length];
}

export const TITLE_COUNT = TITLES.length;
