# TimeTrack backup agent (Linux → SMB share)

A small Node program that runs on a Linux PC and copies backups from the TimeTrack web app to a Windows/Samba network share.

- **Everything is managed in the web app**: Admin → *Backup agent (SMB share)* — share, folder, user, schedule, days, how many to keep, "Back up now". The agent checks in once per scheduled run (or once a week, whichever is sooner), applies the settings, and reports every run (and whether it's online) back to that page.
- **The SMB password is set in the web app (stored encrypted, sent to the agent over HTTPS); `SMB_PASSWORD` in `/etc/timetrack-agent.env` is an optional fallback.
- The agent only makes outbound HTTPS calls to your site — no ports to open.
- Each run saves `TimeTrack_backup_YYYY-MM-DD_HHMMSS.json` (full restore file for Admin → Import) and `.xlsx` (the workbook layout, importable on the Import & saves page), checks the copy's size, then deletes older files of its own kind beyond the "keep" count. It never touches other files in the folder.

## Install (3 steps)

1. In the web app: **Admin → Backup agent → Make an agent token.** Copy it (shown once).
2. On the Linux PC (needs Node 18+; the script installs `smbclient`):
   ```bash
   cd agent && sudo ./install.sh
   sudo nano /etc/timetrack-agent.env      # TT_URL, TT_TOKEN, SMB_PASSWORD
   sudo systemctl restart timetrack-agent
   ```
3. In the web app, fill in the share (`//server/share`), folder and SMB user, tick **Run scheduled backups**, **Save settings**, then press **Back up now** to test. The status line turns green when the agent is online.

Logs: `journalctl -u timetrack-agent -f`. Try without installing: `TT_URL=… TT_TOKEN=… SMB_PASSWORD=… node backup-agent.mjs --once`.

## Notes
- The schedule uses the PC's clock and time zone. If the PC was off at the scheduled time, the backup runs when it's next on that day. A failed run retries after 15 minutes.
- A new token (Admin → Make a new agent token) immediately disconnects the old one.
- Tests: `e2e/agent.spec.ts` runs this program against the dev server with a pretend `smbclient`.
