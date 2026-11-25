#!/usr/bin/env bash
# Installs the TimeTrack backup agent as a systemd service. Run with sudo from this folder.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run with sudo."; exit 1; }
command -v node >/dev/null || { echo "Install Node 18+ first (https://nodejs.org)."; exit 1; }
command -v smbclient >/dev/null || { echo "Installing smbclient…"; (apt-get install -y smbclient || dnf install -y samba-client || yum install -y samba-client); }
id timetrack >/dev/null 2>&1 || useradd --system --home /var/lib/timetrack-agent --shell /usr/sbin/nologin timetrack
mkdir -p /opt/timetrack-agent
cp backup-agent.mjs lib.mjs /opt/timetrack-agent/
[ -f /etc/timetrack-agent.env ] || { cp agent.env.example /etc/timetrack-agent.env; chmod 600 /etc/timetrack-agent.env; chown timetrack /etc/timetrack-agent.env; echo "Edit /etc/timetrack-agent.env, then run: sudo systemctl restart timetrack-agent"; }
cp timetrack-agent.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now timetrack-agent
echo "Installed. Logs: journalctl -u timetrack-agent -f"
