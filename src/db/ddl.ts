// Idempotent DDL kept in sync with schema.ts so the app can create its own tables
// on first run — against embedded Postgres locally, or Neon when DATABASE_URL is set.
export const DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(255) NOT NULL,
    email varchar(255) NOT NULL UNIQUE,
    role varchar(50) NOT NULL DEFAULT 'engineer',
    qb_employee_name varchar(255),
    password_hash text,
    default_hourly_rate numeric(10,2) DEFAULT 250.00,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(255) NOT NULL,
    qb_name varchar(255) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    full_qb_job_name varchar(255) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS service_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(255) NOT NULL,
    qb_item_name varchar(255) NOT NULL,
    default_billable boolean NOT NULL DEFAULT true,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS time_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
    job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
    service_item_id uuid REFERENCES service_items(id) ON DELETE CASCADE,
    date date NOT NULL,
    duration_minutes integer NOT NULL,
    location_type varchar(50) NOT NULL DEFAULT 'office',
    location_name varchar(255),
    latitude numeric(10,7),
    longitude numeric(10,7),
    notes text,
    is_billable boolean NOT NULL DEFAULT true,
    status varchar(50) NOT NULL DEFAULT 'submitted',
    flagged boolean NOT NULL DEFAULT false,
    flag_reason text,
    flag_history text,
    dismissed_issues text,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS active_timers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
    job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
    service_item_id uuid REFERENCES service_items(id) ON DELETE SET NULL,
    location_type varchar(50) NOT NULL DEFAULT 'office',
    start_time timestamp NOT NULL,
    paused_duration_seconds integer NOT NULL DEFAULT 0,
    is_running boolean NOT NULL DEFAULT true,
    notes text,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS app_meta (
    key varchar(100) PRIMARY KEY,
    value text
  )`,
  // Upgrades for databases created before these columns existed.
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text`,
  `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS flagged boolean NOT NULL DEFAULT false`,
  `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS flag_reason text`,
  `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS flag_history text`,
  `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS dismissed_issues text`,
  // Emails are lowercase everywhere (skips any that would collide with another person's).
  `UPDATE users u SET email = lower(btrim(u.email)) WHERE u.email <> lower(btrim(u.email)) AND NOT EXISTS (SELECT 1 FROM users o WHERE o.id <> u.id AND lower(btrim(o.email)) = lower(btrim(u.email)))`,
  // Customer and task are optional on a time entry.
  `ALTER TABLE time_entries ALTER COLUMN customer_id DROP NOT NULL`,
  `ALTER TABLE time_entries ALTER COLUMN service_item_id DROP NOT NULL`,
  `CREATE INDEX IF NOT EXISTS time_entries_user_date_idx ON time_entries (user_id, date)`,
  // Billing workbook: lump sum, parts, contract/PO, invoiced and held time on each entry; billing rates default to 250.
  `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS is_lump_sum boolean NOT NULL DEFAULT false`,
  `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS parts_note text`,
  `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS internal_note text`,
  `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS contract_po varchar(255)`,
  `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS is_invoiced boolean NOT NULL DEFAULT false`,
  `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS invoiced_on date`,
  `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS is_held boolean NOT NULL DEFAULT false`,
  `ALTER TABLE users ALTER COLUMN default_hourly_rate SET DEFAULT 250.00`,
  `CREATE TABLE IF NOT EXISTS billing_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind varchar(20) NOT NULL,
    customer varchar(255) NOT NULL DEFAULT '',
    description text NOT NULL DEFAULT '',
    amount numeric(12,2) NOT NULL DEFAULT 0,
    notes text,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
    customer_name varchar(255) NOT NULL,
    date_from date NOT NULL,
    date_to date NOT NULL,
    total numeric(12,2) NOT NULL DEFAULT 0,
    snapshot text,
    created_by varchar(255),
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS invoices_customer_idx ON invoices (customer_id, date_to)`,
];
