# Setup & Deployment Guide

> **Current behaviour (read this first)**
> - **Data is stored in a real Postgres database.** Without `DATABASE_URL` the app uses an embedded Postgres saved in `./.data/pglite`
>   (persists across restarts, no account needed); with `DATABASE_URL` it uses Neon. Tables are created automatically.
> - **Sign-in:** each person has their own password. Accountants/admins manage people, rates and passwords; engineers only see their own time (everyone can create invoices on the Billing page).
>   Set `ENABLE_DEMO_DATA=false` for a blank start — the first visit creates the first admin. With demo data every sample password is `demo1234`.
> - **Invoices:** *Billing* builds per-customer invoices from billable time; *Mark as invoiced* flags the time so it isn't billed twice. Invoiced time can still be edited, but anyone can delete an invoice (its time goes back to not invoiced).
> - Run the browser tests with `npm run test:e2e` (uses a throwaway in-memory database).


This guide covers local development, Neon database provisioning, and deployment to Vercel.

---

## 1. Local Development Setup

### Prerequisites
- Node.js 18+ (tested with Node 20 / 22 / 24)
- npm or yarn / pnpm

### Installation
```bash
cd "Time Tracker"
npm install
```

### Environment Configuration
Create a `.env.local` file by copying `.env.example`:
```bash
cp .env.example .env.local
```

Contents of `.env.local`:
```env
# Database Connection (Neon PostgreSQL)
# Example: postgresql://username:password@ep-cool-frost-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
DATABASE_URL=

# Fallback/Demo Mode:
# When DATABASE_URL is empty or unreachable, the app automatically runs in Mock/In-Memory mode
# so you can immediately explore and test all features without database setup!
ENABLE_DEMO_DATA=true

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Running Locally
```bash
npm run dev
```
Visit `http://localhost:3000` to access the application.

---

## 2. Setting Up Neon Database (PostgreSQL)

1. Go to [Neon.tech](https://neon.tech) and create a free account.
2. Click **Create Project**.
3. Choose a project name (e.g. `engineer-time-tracker`) and select a region close to your Vercel deployment (e.g., `US East (Ohio)` or `US East (N. Virginia)`).
4. Once created, copy the **Connection string** (choose `Postgres` or `Pooled connection`).
   It will look like:
   `postgresql://neondb_owner:npg_xxxx@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require`
5. Paste this connection string into your `.env.local` as `DATABASE_URL`.

### Push Schema & Seed Initial Data
```bash
# Push database schema to Neon
npm run db:push

# Optional: Seed sample customers, service items, and time entries
npm run db:seed
```

---

## 3. Deploying to Vercel

### Option A: Via Vercel CLI
```bash
npm i -g vercel
vercel
```
Follow the interactive prompts. When prompted for environment variables, add:
* `DATABASE_URL`: Your Neon connection string
* `ENABLE_DEMO_DATA`: `false` (or `true` if you want sample entries)

### Option B: Via GitHub & Vercel Dashboard
1. Push your repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Field & Office Time Tracker"
   git branch -M main
   git remote add origin https://github.com/your-username/time-tracker.git
   git push -u origin main
   ```
2. Log into [Vercel](https://vercel.com) and click **Add New...** > **Project**.
3. Import your `time-tracker` repository.
4. In the **Environment Variables** section, add:
   * `DATABASE_URL` = `<your_neon_connection_string>`
5. Click **Deploy**. Vercel will build and launch your application globally on their Edge/Serverless infrastructure!

---

## 4. Where things live
- `src/app/engineer` – Timesheet; `src/app/billing` – Billing; `src/app/(data)` – Customers / Lump sum / Other / Held time
- `src/lib/invoice.ts` – invoice maths shared by the screen, server and Excel; `src/lib/invoice-excel.ts` – Excel sheets; `src/lib/hours.ts` – hours calculator
- `src/db/` – Drizzle schema, idempotent DDL (`ddl.ts`), store, demo seed (from `workbook-demo.json`)
- `ARCHITECTURE.md` – design and API list
