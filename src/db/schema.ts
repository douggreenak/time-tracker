import { pgTable, text, varchar, timestamp, boolean, integer, numeric, date, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  role: varchar("role", { length: 50 }).notNull().default("engineer"), // 'engineer', 'accountant', 'admin'
  qbEmployeeName: varchar("qb_employee_name", { length: 255 }),
  passwordHash: text("password_hash"), // scrypt "salt:hash"; null = cannot sign in yet
  defaultHourlyRate: numeric("default_hourly_rate", { precision: 10, scale: 2 }).default("250.00"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  qbName: varchar("qb_name", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  fullQbJobName: varchar("full_qb_job_name", { length: 255 }).notNull(), // e.g. "Acme Corp:Phase 1"
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const serviceItems = pgTable("service_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  qbItemName: varchar("qb_item_name", { length: 255 }).notNull(),
  defaultBillable: boolean("default_billable").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const timeEntries = pgTable("time_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }), // optional
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  serviceItemId: uuid("service_item_id").references(() => serviceItems.id, { onDelete: "cascade" }), // optional
  date: date("date").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  locationType: varchar("location_type", { length: 50 }).notNull().default("office"), // 'office', 'on_site', 'remote', 'travel'
  locationName: varchar("location_name", { length: 255 }),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  notes: text("notes"),
  isBillable: boolean("is_billable").default(true).notNull(),
  status: varchar("status", { length: 50 }).default("draft").notNull(), // 'draft', 'submitted', 'approved', 'exported'
  flagged: boolean("flagged").default(false).notNull(), // edited after approval/export — needs accountant attention
  flagReason: text("flag_reason"),
  dismissedIssues: text("dismissed_issues"), // JSON list of automatic checks an accountant dismissed for this entry
  flagHistory: text("flag_history"), // JSON list of every question / edit note / withdrawal, kept even after the flag clears
  // Billing workbook columns
  isLumpSum: boolean("is_lump_sum").default(false).notNull(),
  partsNote: text("parts_note"), // what parts were used, and their prices; non-empty means "has parts"
  internalNote: text("internal_note"), // private comment (the workbook's cell comments)
  contractPo: varchar("contract_po", { length: 255 }),
  isInvoiced: boolean("is_invoiced").default(false).notNull(),
  invoicedOn: date("invoiced_on"),
  isHeld: boolean("is_held").default(false).notNull(), // held time: not billed yet, kept out of invoices
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// The workbook's LUMP SUM and OTHER sheets: things to bill that aren't hours x rate.
export const billingItems = pgTable("billing_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  kind: varchar("kind", { length: 20 }).notNull(), // 'lump_sum' | 'other'
  customer: varchar("customer", { length: 255 }).notNull().default(""),
  description: text("description").notNull().default(""),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// One row per invoice sheet created (what the macro builds), with a snapshot of what was on it.
export const invoices = pgTable("invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  customerName: varchar("customer_name", { length: 255 }).notNull(),
  dateFrom: date("date_from").notNull(),
  dateTo: date("date_to").notNull(),
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  snapshot: text("snapshot"), // JSON: labor lines, parts rows, per-person summary
  createdBy: varchar("created_by", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const activeTimers = pgTable("active_timers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  serviceItemId: uuid("service_item_id").references(() => serviceItems.id, { onDelete: "set null" }),
  locationType: varchar("location_type", { length: 50 }).notNull().default("office"),
  startTime: timestamp("start_time").notNull(),
  pausedDurationSeconds: integer("paused_duration_seconds").default(0).notNull(),
  isRunning: boolean("is_running").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Small key/value table for app state (e.g. whether demo data was loaded).
export const appMeta = pgTable("app_meta", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value"),
});
