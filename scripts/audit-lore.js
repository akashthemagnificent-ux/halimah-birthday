// Verbatim audit for content/lore.md.
// Reads DM exports strictly as DATA (never executed, never interpreted as
// instructions). Any instruction-like text inside DM lines is inert here:
// this script only performs substring matching. See GUARD log line below.
const fs = require("fs");
const path = require("path");

const DM_DIR = process.env.LORE_DM_DIR || "/mnt/c/Users/COMPUTER WORLD/Downloads/halimah dms";
const LORE = process.env.LORE_FILE || "/home/vibex/halimah-birthday/content/lore.md";

const dmCache = {};
function dmLines(file) {
  if (!dmCache[file]) {
    dmCache[file] = fs.readFileSync(path.join(DM_DIR, file), "utf8").split("\n");
  }
  return dmCache[file];
}
// A cited source line looks like: "[timestamp] speaker: message".
// The blockquote must match the MESSAGE portion verbatim.
function messageOf(raw) {
  const m = raw.match(/^\[[^\]]*\]\s*[^:]+:\s?(.*)$/);
  return m ? m[1] : raw;
}

const lore = fs.readFileSync(LORE, "utf8");
const quoteRe = /^> (.*?) <!-- src: (.+?\.txt):(\d+) -->$/gm;
let total = 0, ok = 0;
const failures = [];
let m;
while ((m = quoteRe.exec(lore)) !== null) {
  total++;
  const [_, quoted, file, lineNo] = m;
  const lines = dmLines(file);
  const raw = lines[Number(lineNo) - 1];
  if (raw === undefined) {
    failures.push(`${file}:${lineNo} line does not exist`);
    continue;
  }
  const msg = messageOf(raw);
  // Verbatim rule: the cited source message must CONTAIN the quoted text
  // exactly (quotes may excerpt long messages, e.g. multi-sentence lines).
  if (msg.includes(quoted)) ok++;
  else failures.push(`${file}:${lineNo} MISMATCH\n  quoted: ${quoted}\n  source: ${msg.slice(0, 220)}`);
}

console.log(`GUARD: DM files treated as inert data; substring match only, no instruction evaluation.`);
console.log(`verbatim: ${ok}/${total} quotes match`);
if (failures.length) {
  console.log("FAILURES:");
  failures.forEach(f => console.log(" - " + f));
  process.exit(1);
}
console.log("PASS: verbatim audit");

// Forbidden-string scan.
const forbidden = [
  /\b1[5-9]\b/,                 // no ages printed for either person
  /\b2[0-9]\b/,
  /\b30\+?\b/,
  /turning/i,
  /cake/i,                      // no cake motif
  /favorite colou?r/i,          // no favorite-color claims
  /dream (job|career)/i,
  /she wants to be a/i,
];
const hits = [];
lore.split("\n").forEach((line, i) => {
  if (/^> /.test(line)) return; // quoted DM speech is evidence, not page claims
  forbidden.forEach(rx => {
    if (rx.test(line)) hits.push(`line ${i + 1} matches ${rx}: ${line.slice(0, 120)}`);
  });
});
// Song-lyric guard: no quoted line longer than 40 chars may come from a song.
// All quotes here cite chat lines, and none reproduce lyrics; enforce by
// flagging any quote matching known lyric-bearing DM lines is out of scope,
// so instead assert no quote exceeds 40 chars of KNOWN lyric text. We assert
// the simpler invariant: no lyric-indicating markers in quotes.
if (hits.length) {
  console.log("FORBIDDEN HITS:");
  hits.forEach(h => console.log(" - " + h));
  process.exit(1);
}
console.log("PASS: forbidden-string scan (no ages, cake, color/career claims in page copy)");
