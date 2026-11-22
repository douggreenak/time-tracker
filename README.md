# Field & Office Time Tracker for Engineers

A modern, mobile-friendly time tracking web application designed specifically for field & office engineers, with an accountant portal and seamless **QuickBooks Desktop** import capabilities (both `.iif` and `.csv`).

Built to be hosted on **Vercel** with a **Neon PostgreSQL** database, and architected with a decoupled REST API so an **iOS native app** can be easily integrated later.

---

## 🚀 Key Features

* **Engineer View (Field & Office Optimized)**:
  * **Live Stopwatch Timer**: Persistent start/pause/stop timer that stays accurate across device reloads.
  * **Manual Entry Mode**: Enter hours, date, customer/job, service item, and notes directly.
  * **Location Tagging**: Categorize work as **Office**, **On-Site Client**, **Remote**, or **Travel**, with optional one-tap GPS coordinate capture.
  * **Mobile-Responsive**: Designed with touch-friendly controls for mobile devices in the field.

* **Accountant & Admin View**:
  * **Review & Filter Dashboard**: Filter time entries by date range, customer, engineer, and billable status.
  * **Metric Summaries**: Real-time totals for billable vs. non-billable hours, breakdown by customer, and location analysis.
  * **Status Workflow**: Mark time entries as *Draft*, *Submitted*, *Approved*, or *Exported*.

* **QuickBooks Desktop Integration**:
  * **Native `.iif` Export**: Generates true QuickBooks Desktop Timer activity (`TIMEACT`) files formatted for direct import via `File > Utilities > Import > IIF Files`.
  * **CSV / Excel Export**: Clean, audit-ready CSV format for spreadsheet reporting or QB Desktop Advanced Import.
  * **Customer : Job Support**: Full parent/child hierarchical naming (`Customer:Job`) conforming to QuickBooks standards.
  * **Service & Payroll Items**: Map activities to QB Service Items (e.g., *Engineering Services*, *Site Inspection*).

* **Future-Proof iOS Ready**:
  * Clean RESTful API routes (`/api/time-entries`, `/api/customers`, etc.) ready to serve as the backend for a native Swift/SwiftUI iOS app.

---

## 🛠 Tech Stack

* **Framework**: Next.js 14+ (App Router), React 18/19, TypeScript
* **Styling**: Tailwind CSS, Lucide React icons
* **Database**: Neon Serverless PostgreSQL (via Drizzle ORM / Neon Serverless SDK)
* **Hosting**: Vercel
* **Formats**: RFC-standard `.iif` (tab-delimited QuickBooks format) & CSV

---

## 📁 Repository Structure

```text
├── ARCHITECTURE.md            # System design, data models & iOS expansion plan
├── QUICKBOOKS_INTEGRATION.md  # QuickBooks Desktop .iif format spec & import guide
├── SETUP.md                   # Step-by-step local setup & Vercel/Neon deployment
├── README.md                  # This document
├── drizzle.config.ts          # Drizzle ORM configuration for Neon
├── src/
│   ├── app/                   # Next.js App Router pages and API routes
│   │   ├── page.tsx           # Landing / role selector
│   │   ├── engineer/          # Engineer timer & manual time logging interface
│   │   ├── accountant/        # Accountant dashboard, review, & QB export
│   │   ├── settings/          # Customer, Job, Service Item & Employee management
│   │   └── api/               # REST API endpoints for web & future iOS app
│   │       ├── time-entries/  # CRUD for time logs
│   │       ├── timer/         # Live timer start/stop/status
│   │       ├── customers/     # Customer & Job directory
│   │       ├── service-items/ # QB Service items
│   │       ├── users/         # Engineers and accountants
│   │       └── export/        # .iif and .csv generation endpoints
│   ├── components/            # UI components (Timer, Forms, Tables, Exports)
│   ├── db/                    # Drizzle schema, DB client, and migration scripts
│   └── lib/                   # Utilities (QuickBooks IIF generator, CSV generator, formatters)
```

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env.local` and configure your database:
```bash
cp .env.example .env.local
```
*(If you do not have a Neon database ready yet, the app includes an automatic SQLite/in-memory fallback so you can test immediately!)*

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📖 In-Depth Guides

* Read [ARCHITECTURE.md](file:///Users/doug/Desktop/Claude/Time%20Tracker/ARCHITECTURE.md) for database schema, API contracts, and how the iOS native app will integrate.
* Read [QUICKBOOKS_INTEGRATION.md](file:///Users/doug/Desktop/Claude/Time%20Tracker/QUICKBOOKS_INTEGRATION.md) for QuickBooks Desktop IIF specifications, import steps, and troubleshooting.
* Read [SETUP.md](file:///Users/doug/Desktop/Claude/Time%20Tracker/SETUP.md) for Vercel and Neon deployment instructions.
