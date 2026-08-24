// Export the 45 hand-keyed, validated quotes as estimator templates.
// Run: CAPTURE_TEMPLATES=1 npx tsx scripts/export-templates.ts
import fs from "fs";
import { captured } from "../validation/handkey/runner";

process.env.CAPTURE_TEMPLATES = "1";
const files = fs.readdirSync("validation/handkey").filter((f) => f.startsWith("t") && f.endsWith(".ts"));
(async () => {
  for (const f of files.sort()) await import("../validation/handkey/" + f.replace(".ts", ""));
  const templates = captured.map((c) => ({
    est: c.est,
    label: `#${c.est} — ${(c.form as any).jobTitle || c.desc} — qty ${(c.form as any).quantity?.toLocaleString?.() || (c.form as any).quantity} — $${c.letterPrice.toLocaleString()}`,
    desc: c.desc,
    form: c.form,
  }));
  fs.writeFileSync("src/data/quote-templates.json", JSON.stringify(templates, null, 1));
  console.log("exported", templates.length, "templates");
})();
