/** Quick sanity check: key files exist and the project type-checks. */
import fs from "fs";
import { execSync } from "child_process";

const required = [
  "README.md", "ARCHITECTURE.md", "SETUP.md", ".env.example",
  "src/app/engineer/page.tsx", "src/app/billing/page.tsx",
  "src/app/api/time-entries/route.ts", "src/app/api/billing/preview/route.ts", "src/app/api/billing/excel/route.ts",
  "src/app/api/invoices/route.ts", "src/lib/invoice.ts", "src/lib/invoice-excel.ts",
  "src/db/schema.ts", "src/db/store.ts", "src/db/workbook-demo.json",
];
let ok = true;
for (const f of required) {
  if (fs.existsSync(f)) console.log(`✅ ${f}`);
  else { console.error(`❌ missing ${f}`); ok = false; }
}
try {
  execSync("npx tsc --noEmit", { stdio: "inherit" });
  console.log("✅ TypeScript type checking passed");
} catch {
  console.error("❌ TypeScript errors");
  ok = false;
}
if (!ok) process.exit(1);
console.log("All checks passed.");
