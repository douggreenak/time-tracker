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
    default_hourly_rate numeric(10,2) DEFAULT 125.00,
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
  // Customer and task are optional on a time entry.
  `ALTER TABLE time_entries ALTER COLUMN customer_id DROP NOT NULL`,
  `ALTER TABLE time_entries ALTER COLUMN service_item_id DROP NOT NULL`,
  `CREATE INDEX IF NOT EXISTS time_entries_user_date_idx ON time_entries (user_id, date)`,
];
