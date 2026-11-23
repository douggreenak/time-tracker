/**
 * QuickBooks Desktop IIF & CSV Export Utility
 *
 * Conforms to Intuit QuickBooks Desktop Time Tracking specifications.
 * TIMEACT records allow direct import into QuickBooks Desktop via:
 * File > Utilities > Import > IIF Files
 */

export interface ExportableTimeEntry {
  id: string;
  date: string; // YYYY-MM-DD or MM/DD/YYYY
  employeeName: string;
  customerName: string;
  jobName?: string | null;
  serviceItemName: string;
  payrollItemName?: string | null;
  durationMinutes: number;
  locationType: string;
  locationName?: string | null;
  notes?: string | null;
  isBillable: boolean;
  status: string;
}

/**
 * Converts a date string (YYYY-MM-DD or ISO) to QuickBooks Desktop format: MM/DD/YYYY
 */
export function formatQuickBooksDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${month.padStart(2, "0")}/${day.padStart(2, "0")}/${year}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/**
 * Formats duration in minutes into QuickBooks HH:MM duration format
 * e.g., 90 minutes -> "01:30"
 */
export function formatQuickBooksDuration(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hrs = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/**
 * Formats Job/Customer hierarchy.
 * In QuickBooks Desktop: "Customer:Job" or "Customer"
 */
export function formatQuickBooksJob(customerName: string, jobName?: string | null): string {
  const trimmedCust = (customerName || "").trim();
  const trimmedJob = (jobName || "").trim();
  if (trimmedJob && trimmedJob.toLowerCase() !== "none" && trimmedJob.toLowerCase() !== "general") {
    // Check if jobName already includes the customer name
    if (trimmedJob.startsWith(trimmedCust + ":")) {
      return trimmedJob;
    }
    return `${trimmedCust}:${trimmedJob}`;
  }
  return trimmedCust;
}

/**
 * Clean strings for tab-delimited IIF files (remove tabs and newlines to prevent column breaks)
 */
function cleanIifField(str?: string | null): string {
  if (!str) return "";
  return str.replace(/\t/g, " ").replace(/[\r\n]+/g, " - ").trim();
}

/**
 * Generates valid QuickBooks Desktop .iif content for Time Tracking (TIMEACT)
 */
export function generateQuickBooksIIF(entries: ExportableTimeEntry[]): string {
  // 1. Header definition for Time Tracking
  const header = "!TIMEACT\tDATE\tJOB\tEMP\tITEM\tPITEM\tDURATION\tNOTE\tBILLINGSTATUS";

  // 2. Data rows
  const rows = entries.map((entry) => {
    const qbDate = formatQuickBooksDate(entry.date);
    const qbJob = cleanIifField(formatQuickBooksJob(entry.customerName, entry.jobName));
    const qbEmp = cleanIifField(entry.employeeName || "Engineer");
    const qbItem = cleanIifField(entry.serviceItemName || "");
    const qbPItem = cleanIifField(entry.payrollItemName || "");
    const qbDuration = formatQuickBooksDuration(entry.durationMinutes);

    // Format note with location metadata
    const locTag = entry.locationType ? `[Location: ${entry.locationType.replace("_", " ").toUpperCase()}${entry.locationName ? ` - ${entry.locationName}` : ""}]` : "";
    const fullNote = cleanIifField([entry.notes, locTag].filter(Boolean).join(" "));

    // BILLINGSTATUS: 0 = Not Billable, 1 = Billable, 2 = Billed
    const billingStatus = entry.isBillable ? "1" : "0";

    return `TIMEACT\t${qbDate}\t${qbJob}\t${qbEmp}\t${qbItem}\t${qbPItem}\t${qbDuration}\t${fullNote}\t${billingStatus}`;
  });

  // End with newline
  return [header, ...rows].join("\r\n") + "\r\n";
}

/**
 * Generates CSV content suitable for QuickBooks Desktop Advanced Import and Excel
 */
export function generateTimeTrackingCSV(entries: ExportableTimeEntry[]): string {
  const headers = [
    "Date",
    "Employee",
    "Customer",
    "Job",
    "Full_Job_Hierarchy",
    "Service_Item",
    "Hours",
    "Minutes",
    "Decimal_Hours",
    "Location_Type",
    "Location_Detail",
    "Billable",
    "Status",
    "Notes"
  ];

  const escapeCSV = (field: string | number | boolean | null | undefined): string => {
    if (field === null || field === undefined) return '""';
    let str = String(field);
    // Stop Excel/Sheets from running text like =HYPERLINK(...) typed into a note as a formula.
    if (typeof field === "string" && /^[=+\-@\t\r]/.test(str)) str = `'${str}`;
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  const rows = entries.map((e) => {
    const hrs = Math.floor(e.durationMinutes / 60);
    const mins = e.durationMinutes % 60;
    const decimalHours = (e.durationMinutes / 60).toFixed(2);
    const fullJob = formatQuickBooksJob(e.customerName, e.jobName);

    return [
      escapeCSV(e.date),
      escapeCSV(e.employeeName),
      escapeCSV(e.customerName),
      escapeCSV(e.jobName || ""),
      escapeCSV(fullJob),
      escapeCSV(e.serviceItemName),
      hrs,
      mins,
      decimalHours,
      escapeCSV(e.locationType),
      escapeCSV(e.locationName || ""),
      e.isBillable ? "Yes" : "No",
      escapeCSV(e.status),
      escapeCSV(e.notes || "")
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\r\n") + "\r\n";
}
