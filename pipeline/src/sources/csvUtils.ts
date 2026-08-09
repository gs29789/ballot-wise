// Minimal quote-aware CSV line parser. Several bulk-data sources this
// pipeline reads (Voteview, Bridge Grades) have at least one quoted column
// containing a comma — confirmed on real data that naively splitting every
// line on "," silently shifts every column after it by one position for
// every affected row. A full CSV library would be unjustified weight for
// the handful of flat, well-formed files this pipeline actually reads.
export function parseCsvLine(rawLine: string): string[] {
  // Strip a trailing \r — confirmed on real data (Bridge Grades' CSV uses
  // \r\n line endings) that splitting the response text on "\n" alone
  // leaves a stray \r stuck onto the last column of every line, silently
  // breaking any lookup of that column's header name (e.g. "profile_url"
  // never matches "profile_url\r").
  const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
  const cols: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cols.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cols.push(cur);
  return cols;
}
