# Setup & Deployment Guide

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

## 4. Next Agent Handoff / Transfer Checklist

If you are continuing this project in a new session or with another agent:
1. All core project specifications are documented in:
   - `ARCHITECTURE.md` (System components, database schemas, API specs, iOS roadmap)
   - `QUICKBOOKS_INTEGRATION.md` (QuickBooks Desktop `.iif` format details and validation)
   - `SETUP.md` (Deployment and configuration)
2. The codebase uses clean modular paths:
   - `src/app/engineer`: Mobile-responsive timer & time logger
   - `src/app/accountant`: Review table, filters, and `.iif`/`.csv` export buttons
   - `src/lib/quickbooks.ts`: Engine for generating valid QuickBooks Desktop `.iif` output
   - `src/db/`: Drizzle ORM schema & Neon client
