// Tone lint: every room marked <!-- type: gag --> must contain an
// affection closer ("Affection closer:") in the same room section.
// Usage: node tone-lint.js [file]
const fs = require("fs");
const file = process.argv[2] || "/home/vibex/halimah-birthday/content/lore.md";
const text = fs.readFileSync(file, "utf8");
const sections = text.split(/^## /m).slice(1);
let fail = 0;
sections.forEach(sec => {
  const title = sec.split("\n")[0];
  const isGag = /<!--\s*type:\s*gag\s*-->/.test(title);
  if (isGag && !/Affection closer:/.test(sec)) {
    console.log(`FAIL: gag room without affection closer -> ${title}`);
    fail++;
  }
});
if (fail) {
  console.log(`tone lint: ${fail} gag room(s) missing affection closer`);
  process.exit(1);
}
console.log("PASS: every gag room has an affection closer");
