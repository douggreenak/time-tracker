# System Architecture & Technical Specifications

This document outlines the architectural blueprint, database design, API specification, and future iOS native app roadmap for the **Field & Office Time Tracker**.

---

## 1. High-Level Architecture

```text
┌────────────────────────────────────────────────────────┐
│                   Clients                              │
│  ┌───────────────────────┐   ┌───────────────────────┐ │
│  │ Mobile/Desktop Web    │   │ Future iOS App        │ │
│  │ (Next.js + Tailwind)  │   │ (Swift / SwiftUI)     │ │
│  └───────────┬───────────┘   └───────────┬───────────┘ │
└──────────────┼───────────────────────────┼─────────────┘
               │                           │
               ▼                           ▼
┌────────────────────────────────────────────────────────┐
│                   Next.js API Layer                    │
│   (Hosted on Vercel Serverless / Edge Functions)       │
│                                                        │
│  • /api/time-entries  (CRUD + Filters)                 │
│  • /api/timer         (Active Stopwatch State)         │
│  • /api/customers     (Hierarchical Customer:Job)      │
│  • /api/service-items (QB Service/Payroll items)       │
│  • /api/export/iif    (QB Desktop IIF Engine)          │
│  • /api/export/csv    (Universal CSV Export)           │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                   Neon PostgreSQL                      │
│             (Serverless Cloud Database)                │
│                                                        │
│  • users / employees                                   │
│  • customers & jobs                                    │
│  • service_items                                       │
│  • time_entries                                        │
│  • active_timers                                       │
└────────────────────────────────────────────────────────┘
```

---

## 2. Database Schema (PostgreSQL / Neon)

Using Drizzle ORM for type-safe schema definitions and zero-friction migrations.

### Table: `users`
Represents engineers and accountants.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | Primary Key, default random | Unique User ID |
| `name` | `varchar(255)` | Not Null | Full Name |
| `email` | `varchar(255)` | Not Null, Unique | Email address |
| `role` | `varchar(50)` | Not Null | `'engineer'`, `'accountant'`, `'admin'` |
| `qb_employee_name` | `varchar(255)` | Nullable | Exact name as registered in QuickBooks Desktop |
| `default_hourly_rate` | `numeric(10,2)` | Nullable | Default billing rate per hour |
| `created_at` | `timestamp` | Default `now()` | Record creation timestamp |

### Table: `customers`
Customers and parent accounts.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | Primary Key, default random | Unique Customer ID |
| `name` | `varchar(255)` | Not Null | Company or Client Name |
| `qb_name` | `varchar(255)` | Not Null | Name matching QuickBooks Desktop |
| `is_active` | `boolean` | Default `true` | Active status flag |
| `created_at` | `timestamp` | Default `now()` | Record creation timestamp |

### Table: `jobs` (Sub-projects)
Projects or sub-jobs belonging to a customer.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | Primary Key, default random | Unique Job ID |
| `customer_id` | `uuid` | Foreign Key (`customers.id`) | Parent customer reference |
| `name` | `varchar(255)` | Not Null | Project / Phase name |
| `full_qb_job_name` | `varchar(255)` | Not Null | Formatted as `Customer:Job` for QuickBooks Desktop |
| `is_active` | `boolean` | Default `true` | Active status flag |

### Table: `service_items`
QuickBooks service items for activity classification.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | Primary Key, default random | Unique Item ID |
| `name` | `varchar(255)` | Not Null | Display name (e.g., "Site Inspection") |
| `qb_item_name` | `varchar(255)` | Not Null | QuickBooks Service Item name |
| `default_billable` | `boolean` | Default `true` | Whether defaulted to billable |

### Table: `time_entries`
The core timesheet logs.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | Primary Key, default random | Unique Entry ID |
| `user_id` | `uuid` | Foreign Key (`users.id`) | Engineer logging the time |
| `customer_id` | `uuid` | Foreign Key (`customers.id`) | Customer worked on |
| `job_id` | `uuid` | Nullable, Foreign Key (`jobs.id`)| Specific Job / Phase |
| `service_item_id` | `uuid` | Foreign Key (`service_items.id`)| Service Item |
| `date` | `date` | Not Null | Work date (`YYYY-MM-DD`) |
| `duration_minutes` | `integer` | Not Null | Total elapsed time in minutes |
| `location_type` | `varchar(50)` | Not Null | `'office'`, `'on_site'`, `'remote'`, `'travel'` |
| `location_name` | `varchar(255)` | Nullable | Specific site address or office room |
| `latitude` | `numeric(10,7)` | Nullable | GPS latitude coordinate (optional) |
| `longitude` | `numeric(10,7)`| Nullable | GPS longitude coordinate (optional) |
| `notes` | `text` | Nullable | Description of work performed |
| `is_billable` | `boolean` | Default `true` | Billable to client flag |
| `status` | `varchar(50)` | Default `'submitted'` | `'draft'`, `'submitted'`, `'approved'`, `'exported'` |
| `created_at` | `timestamp` | Default `now()` | Logged at timestamp |
| `updated_at` | `timestamp` | Default `now()` | Updated at timestamp |

### Table: `active_timers`
Persists currently ticking timers so engineers do not lose active sessions upon closing the browser or changing locations.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | Primary Key, default random | Unique Timer ID |
| `user_id` | `uuid` | Unique, Foreign Key (`users.id`)| Single active timer per user |
| `customer_id` | `uuid` | Nullable | Pre-selected customer |
| `job_id` | `uuid` | Nullable | Pre-selected job |
| `service_item_id` | `uuid` | Nullable | Pre-selected service item |
| `location_type` | `varchar(50)` | Default `'office'` | Current location category |
| `start_time` | `timestamp` | Not Null | Time when stopwatch started |
| `paused_duration_seconds`| `integer` | Default `0` | Accumulated seconds before pause |
| `is_running` | `boolean` | Default `true` | Running vs paused flag |
| `notes` | `text` | Nullable | Draft notes |

---

## 3. API Contract (REST)

All API responses return JSON with standard HTTP status codes:
- `200 OK` / `201 Created`
- `400 Bad Request` (Validation errors)
- `404 Not Found`
- `500 Internal Server Error`

### Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/time-entries` | Query time logs with query params (`startDate`, `endDate`, `userId`, `customerId`, `status`, `billable`) |
| `POST` | `/api/time-entries` | Create a new manual time log |
| `PUT` | `/api/time-entries/:id` | Update an existing time log |
| `DELETE` | `/api/time-entries/:id` | Delete a time log |
| `GET` | `/api/timer` | Fetch current active timer session for a user |
| `POST` | `/api/timer/start` | Start or resume active stopwatch |
| `POST` | `/api/timer/pause` | Pause active stopwatch |
| `POST` | `/api/timer/stop` | Stop active stopwatch and convert directly into a `time_entry` |
| `GET` | `/api/customers` | List all active customers and their jobs |
| `POST` | `/api/customers` | Create a customer |
| `GET` | `/api/service-items`| List service items |
| `GET` | `/api/users` | List engineers & accountants |
| `GET` | `/api/export/iif` | Generate and download QuickBooks Desktop `.iif` timer file |
| `GET` | `/api/export/csv` | Generate and download structured CSV file |

---

## 4. Mobile Responsiveness & iOS Expansion Plan

### Current Phase: Responsive Mobile Web App
* Built with a "mobile-first" mindset using Tailwind responsive breakpoints (`sm:`, `md:`, `lg:`).
* Touch-target sizes are at least 44x44px.
* Single-handed bottom bar or prominent action buttons for starting/stopping the timer on phones.
* Supports HTML5 Geolocation API (`navigator.geolocation`) to stamp site locations automatically on arrival.

### Future Phase: Native iOS App (Swift & SwiftUI)
Because the Next.js backend is fully decoupled into REST API endpoints:
1. **Networking**: The Swift app uses `URLSession` or `Alamofire` calling `https://your-domain.vercel.app/api/...`.
2. **Offline Mode**: iOS app can store entries in SwiftData / CoreData and sync to `/api/time-entries` when regaining cell reception.
3. **Live Activities / Dynamic Island**: Track active stopwatch directly on the iOS Lock Screen and Dynamic Island using iOS ActivityKit.
4. **Geofencing**: Trigger notifications to start timer when arriving at a customer's registered job site coordinates.
