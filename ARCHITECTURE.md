# Architecture

Next.js 14 (App Router) + Drizzle ORM. Postgres is Neon over HTTP in production, PGlite (embedded) locally and in tests. Tables are created/upgraded by the idempotent list in `src/db/ddl.ts` (additive only; a schema-version hash in `app_meta` skips it on warm starts).

## Data
| Table | Purpose |
|---|---|
| `users` | people; `role` engineer/accountant/admin; `default_hourly_rate` = **billing rate** (default 250) |
| `customers` | the short names billed under (`BLUE WHALE`, `HARBOR WTP`); `is_active` archives |
| `time_entries` | one workbook TIME SUMMARY row: `date`, `duration_minutes` (whole tenths = 6 min), `notes` (description), `is_lump_sum`, `parts_note`, `internal_note`, `contract_po`, `is_billable`, `is_invoiced`, `invoiced_on`, `is_held` |
| `billing_items` | LUMP SUM and OTHER lists (`kind`, customer, description, amount, notes) |
| `invoices` | saved invoices: customer, date range, total, `snapshot` JSON (lines, parts, rates, entry ids) |
| `saved_exports` | monthly/yearly workbook saves (`kind`, `period`, base64 `.xlsx`); one per kind+period |
| `app_meta` | flags (demo, seeded, schema version) |

Left in place but unused by the app: `jobs`, `service_items`, `active_timers`, and the old `status`/`flagged`/location columns on `time_entries` (kept so production data is never dropped).

## Invoice rules (from the workbook macro)
For a date range, each customer with usable time gets one invoice. Usable = billable, not held, not already invoiced (unless "include invoiced"). Lines are ordered by person then date. `total = hours × rate` (hours to 0.1, money to the cent); lump-sum lines total 0. Summary per person: `LABOR HOURS` / `LABOR TOTAL`; `PARTS TOTAL = Σ qty × unit cost`; `INVOICE AMT. DUE = labor + parts`. The server rebuilds every invoice from the database — the browser only sends dates, customer ids and parts rows.

## API (all require sign-in; JSON `{success,data|error}`)
| Route | |
|---|---|
| `GET/POST /api/time-entries`, `GET/PUT/DELETE /api/time-entries/[id]` | engineers: own rows only; only managers set `isInvoiced` or delete invoiced rows |
| `GET/POST /api/customers`, `PUT/DELETE /api/customers/[id]` | `lastInvoiceDate` is computed from saved invoices |
| `GET/POST /api/users`, `PUT/DELETE /api/users/[id]` | rates, roles, passwords (admin rules in `src/lib/auth.ts`) |
| `GET /api/billing/summary?from&to&includeInvoiced` | MACRO DATA table |
| `POST /api/billing/preview` | invoices for `{from,to,customers:[{id,parts}]}` (saves nothing) |
| `POST /api/billing/excel` | same body → `.xlsx`, one sheet per customer |
| `GET/POST /api/invoices`, `GET/DELETE /api/invoices/[id]`, `GET /api/invoices/[id]/excel` | record / list / undo (managers) / re-download |
| `GET/POST /api/billing-items`, `PUT/DELETE /api/billing-items/[id]` | lump sum and other lists |
| `GET /api/export/csv` | time log in workbook column order, formula-safe |
| `/api/auth/*`, `/api/demo`, `/api/health`, backup routes | sign-in, demo clear, health, JSON backup |
| `POST /api/import/preview`, `POST /api/import` | multipart `file` (+ `mapping` sheet→user id, `heldUserId`, `includeHeld`, `includeLists`); duplicates (same person/date/customer/hours/description) are skipped, engineers can only import for themselves |
| `GET/POST /api/snapshots`, `GET /api/snapshots/[id]`, `GET /api/export/workbook?year=` | saved monthly/yearly workbooks; `ensureSnapshots()` runs (throttled) on time-entry loads |

Workbook layout (`src/lib/workbook.ts`) matches the original macro file: `TIME SUMMARY - <NAME>` sheets (header row 2: item, day, date, customer, hours, description, lump sum, parts, contract/PO, billable, invoiced), `HELD TIME`, `LUMP SUM`, `OTHER`, `MACRO DATA`. Cell comments become parts/private notes.
