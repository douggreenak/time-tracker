# 📋 Next Agent Instructions & Project Handoff

Welcome! This document provides everything you need to immediately pick up and continue development or deployment of the **Field & Office Time Tracker**.

---

## 📌 1. Project Overview & Current State

### What Has Been Built
* **Complete System Documentation**:
  * [README.md](file:///Users/doug/Desktop/Claude/Time%20Tracker/README.md): Full feature catalog and navigation.
  * [ARCHITECTURE.md](file:///Users/doug/Desktop/Claude/Time%20Tracker/ARCHITECTURE.md): Database schema (PostgreSQL/Neon), REST API specification, and iOS Swift native app roadmap.
  * [QUICKBOOKS_INTEGRATION.md](file:///Users/doug/Desktop/Claude/Time%20Tracker/QUICKBOOKS_INTEGRATION.md): Detailed Intuit QuickBooks Desktop `.iif` specification, column mapping, `TIMEACT` transaction headers, and accountant import guide.
  * [SETUP.md](file:///Users/doug/Desktop/Claude/Time%20Tracker/SETUP.md): Deployment guide for Vercel and Neon Serverless PostgreSQL.
  * [sample-export.iif](file:///Users/doug/Desktop/Claude/Time%20Tracker/sample-export.iif): Ready-to-import QuickBooks Desktop timer test file.

* **Application Code**:
  * **Engineer View** (`src/app/engineer/page.tsx`):
    * Real-time digital stopwatch with pause/resume/stop.
    * Location category selector: **Office**, **On-Site Client**, **Remote**, **Travel**.
    * One-tap browser GPS coordinate acquisition (`navigator.geolocation`).
    * Manual retrospective entry mode (Date, Duration in hrs/mins, Customer, Sub-Job, Service Item, Billable toggle, Notes).
    * Recent entries list with delete and status tags.
  * **Accountant View** (`src/app/accountant/page.tsx`):
    * Filter toolbar: Date Range, Customer, Engineer, Billable status, Approval status, Search query.
    * KPI summary cards: Total Hours, Billable Hours & Percentage, Est. Billable Revenue ($), Active Customers.
    * Visual analytics: Hours by Customer (ranked bars) and Hours by Location type.
    * Interactive audit table with multi-select and batch status updates (Approve, Mark as Exported).
    * One-click **Download QuickBooks .IIF** button.
    * One-click **Download CSV / Excel** button.
  * **QuickBooks Directory & Settings** (`src/app/settings/page.tsx`):
    * Add/manage Customers and hierarchical Sub-Jobs (`Customer:Job`).
    * Add/manage QuickBooks Service Items with billable defaults.
    * Manage Engineers and their hourly billing rates and QB Employee names.
  * **REST API Layer** (`src/app/api/...`):
    * `/api/time-entries` (GET, POST) & `/api/time-entries/[id]` (GET, PUT, DELETE)
    * `/api/timer` (GET, POST for live stopwatch state)
    * `/api/customers` (GET, POST for customers & jobs)
    * `/api/service-items` (GET, POST)
    * `/api/users` (GET)
    * `/api/export/iif` (GET - direct `.iif` file download)
    * `/api/export/csv` (GET - direct `.csv` file download)
  * **QuickBooks Export Utility** (`src/lib/quickbooks.ts`):
    * Generates valid tab-delimited `TIMEACT` IIF files with sanitized fields.
    * Verified via unit tests (`scripts/test-quickbooks-export.mjs`).
  * **Data Layer** (`src/db/`):
    * `schema.ts`: Drizzle ORM schema for Neon PostgreSQL.
    * `store.ts`: Unified data access layer with built-in instant fallback store.
    * `mock-data.ts`: Seed data with realistic engineering projects and time logs.

---

## ⚡ 2. Immediate Next Steps for the Next Agent

### Step 1: Install Dependencies
Because the user had a slow/metered connection during initial setup, `node_modules` was cleaned before committing.
Once internet is stable, run:
```bash
npm install --legacy-peer-deps --no-audit --no-fund
```

### Step 2: Test Locally
```bash
# Verify export engine
node scripts/test-quickbooks-export.mjs

# Verify all file links and models
node scripts/verify-setup.mjs

# Start Next.js dev server
npm run dev
```
Open `http://localhost:3000` to test both Engineer and Accountant portals.

### Step 3: Connect Neon Database (When Ready)
1. In Neon console, copy connection string:
   `postgresql://[user]:[password]@[host]/neondb?sslmode=require`
2. Create `.env.local` and set `DATABASE_URL`:
   ```bash
   cp .env.example .env.local
   ```
3. Push schema:
   ```bash
   npm run db:push
   ```

### Step 4: Push to Remote Repository (GitHub / Vercel)
If the user provides a GitHub repository URL:
```bash
git remote add origin <github-repo-url>
git push -u origin main
```
Deploy to Vercel with one click by linking the GitHub repository and adding `DATABASE_URL`.
