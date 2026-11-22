/**
 * Self-contained verification script for QuickBooks Desktop IIF & CSV export.
 * Can be run via: node scripts/test-quickbooks-export.mjs
 */

function formatQuickBooksDate(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${month.padStart(2, "0")}/${day.padStart(2, "0")}/${year}`;
  }
  return dateStr;
}

function formatQuickBooksDuration(minutes) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hrs = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function formatQuickBooksJob(customerName, jobName) {
  const trimmedCust = (customerName || "").trim();
  const trimmedJob = (jobName || "").trim();
  if (trimmedJob && trimmedJob.toLowerCase() !== "none") {
    if (trimmedJob.startsWith(trimmedCust + ":")) {
      return trimmedJob;
    }
    return `${trimmedCust}:${trimmedJob}`;
  }
  return trimmedCust;
}

function cleanIifField(str) {
  if (!str) return "";
  return str.replace(/\t/g, " ").replace(/[\r\n]+/g, " - ").trim();
}

function generateQuickBooksIIF(entries) {
  const header = "!TIMEACT\tDATE\tJOB\tEMP\tITEM\tPITEM\tDURATION\tNOTE\tBILLINGSTATUS";
  const rows = entries.map((entry) => {
    const qbDate = formatQuickBooksDate(entry.date);
    const qbJob = cleanIifField(formatQuickBooksJob(entry.customerName, entry.jobName));
    const qbEmp = cleanIifField(entry.employeeName || "Engineer");
    const qbItem = cleanIifField(entry.serviceItemName || "Engineering Services");
    const qbPItem = cleanIifField(entry.payrollItemName || "");
    const qbDuration = formatQuickBooksDuration(entry.durationMinutes);
    const locTag = entry.locationType ? `[Location: ${entry.locationType.replace("_", " ").toUpperCase()}]` : "";
    const fullNote = cleanIifField([entry.notes, locTag].filter(Boolean).join(" "));
    const billingStatus = entry.isBillable ? "1" : "0";

    return `TIMEACT\t${qbDate}\t${qbJob}\t${qbEmp}\t${qbItem}\t${qbPItem}\t${qbDuration}\t${fullNote}\t${billingStatus}`;
  });

  return [header, ...rows].join("\r\n") + "\r\n";
}

// Test sample
const sampleEntries = [
  {
    date: "2026-11-20",
    employeeName: "Doug Mitchell",
    customerName: "Apex Energy Solutions",
    jobName: "Turbine Unit 4 Upgrade",
    serviceItemName: "Field Engineering",
    durationMinutes: 225, // 3h 45m
    locationType: "on_site",
    notes: "Measured vibration harmonic oscillations on turbine shaft bearing housing.",
    isBillable: true,
  },
  {
    date: "2026-11-21",
    employeeName: "Doug Mitchell",
    customerName: "Metro Water District",
    jobName: "Pumping Station B Seismic Retrofit",
    serviceItemName: "Structural Calculations",
    durationMinutes: 150, // 2h 30m
    locationType: "office",
    notes: "Shear wall stress analysis.",
    isBillable: true,
  },
  {
    date: "2026-11-19",
    employeeName: "Doug Mitchell",
    customerName: "Internal Overhead",
    jobName: null,
    serviceItemName: "Admin Overhead",
    durationMinutes: 60,
    locationType: "office",
    notes: "Monthly OSHA compliance & field gear calibration meeting.",
    isBillable: false,
  },
];

console.log("=== VERIFYING QUICKBOOKS IIF OUTPUT ===");
const iif = generateQuickBooksIIF(sampleEntries);
console.log(iif);

// Validations
const lines = iif.trim().split("\r\n");
if (lines[0] !== "!TIMEACT\tDATE\tJOB\tEMP\tITEM\tPITEM\tDURATION\tNOTE\tBILLINGSTATUS") {
  console.error("FAIL: Header mismatch");
  process.exit(1);
}

if (!lines[1].includes("11/20/2026\tApex Energy Solutions:Turbine Unit 4 Upgrade\tDoug Mitchell\tField Engineering\t\t03:45\t")) {
  console.error("FAIL: Line 1 format mismatch:", lines[1]);
  process.exit(1);
}

if (!lines[1].endsWith("\t1")) {
  console.error("FAIL: Billable status on line 1 should be 1");
  process.exit(1);
}

if (!lines[3].endsWith("\t0")) {
  console.error("FAIL: Non-billable status on line 3 should be 0");
  process.exit(1);
}

console.log("✅ All QuickBooks Desktop IIF validation tests passed successfully!");
