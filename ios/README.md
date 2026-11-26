# Time Tracker for iOS

Native SwiftUI app (iOS 26.1+, Liquid Glass) for the Field & Office Time Tracker. It uses the same cloud
backend as the website (`https://timetracker.apexengineeringak.com`), so everything saves to the cloud database
and shows up on the web instantly. Sign-in uses the same accounts and roles.

## Open & run
```bash
cd ios
xcodegen generate        # only needed if project.yml changes; the .xcodeproj is committed
open TimeTracker.xcodeproj
```
Pick a team under *Signing & Capabilities* to run on a device. The app's server can be changed from the
"Server" row on the sign-in screen (e.g. a local `npm run dev`).

## What's in it
- **Timer** – start / pause / resume / stop stopwatch (stored server-side, so web and phone share it); stops into a draft entry. A mini timer shows above the tab bar on other tabs.
- **Timesheet** – weeks (Sun–Sat), add / edit / delete, swipe to submit, "Submit week".
- **Review** (accountants/admins) – to-review / approved / all, approve per person, send back, ask questions, mark exported.
- **Data** – customers, projects, tasks (archive/restore for managers).
- **Account** – profile, change password, team list (managers), sync, sign out.

Not yet in the app (still web-only): QuickBooks IIF / CSV / Excel export, reports, people management, backup.

## Location history (opt-in)

Off by default. Turned on from the Places button (top left of Timesheet) or Account > Places & suggestions.
While on, iOS shows its blue location indicator by the clock. The app keeps at most one point per minute while the
user is moving (100 m accuracy, 75 m distance filter, auto-pausing), stores them only on the device
(`Application Support/location-history.json`, excluded from backup, pruned after 30 days) and never uploads them.
Stays of 10+ minutes form the timeline; non-home stays of 20+ minutes not already covered by logged time are offered as
suggested entries. Signing out stops tracking and erases the history. Debug launch args: `-seedPlaces YES`, `-debugSheet places`.

## Places (location history)
The Places tab keeps a full timeline (an Arc Timeline replacement). Positions are recorded on the phone, queued locally, and uploaded to
`/api/locations/points`; the server builds stays, trips and proposed time entries, so the web Locations / Proposed tabs match. Arc exports
(`.json` / `.json.gz`) can be imported from the tab or on the web. Data is private to each person and is included in the admin backup.
