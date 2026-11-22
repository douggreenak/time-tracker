import { pgTable, text, varchar, timestamp, boolean, integer, numeric, date, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  role: varchar("role", { length: 50 }).notNull().default("engineer"), // 'engineer', 'accountant', 'admin'
  qbEmployeeName: varchar("qb_employee_name", { length: 255 }),
  defaultHourlyRate: numeric("default_hourly_rate", { precision: 10, scale: 2 }).default("125.00"),
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
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  serviceItemId: uuid("service_item_id").references(() => serviceItems.id, { onDelete: "cascade" }).notNull(),
  date: date("date").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  locationType: varchar("location_type", { length: 50 }).notNull().default("office"), // 'office', 'on_site', 'remote', 'travel'
  locationName: varchar("location_name", { length: 255 }),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  notes: text("notes"),
  isBillable: boolean("is_billable").default(true).notNull(),
  status: varchar("status", { length: 50 }).default("submitted").notNull(), // 'draft', 'submitted', 'approved', 'exported'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
