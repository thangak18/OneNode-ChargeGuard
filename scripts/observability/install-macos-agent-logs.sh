#!/bin/sh
# Narrow local configuration change only: enable logs and tail ChargeGuard's JSON file.
set -eu
if [ "$(id -u)" -ne 0 ]; then
  echo 'Run this script with sudo to install the Agent log integration and restart its launch service.' >&2
  exit 1
fi
AGENT_ETC=/opt/datadog-agent/etc
LOG_DIR=/usr/local/var/log/chargeguard
mkdir -p "$LOG_DIR"
if [ -n "${SUDO_USER:-}" ]; then
  chown "$SUDO_USER" "$LOG_DIR"
fi
chmod 755 "$LOG_DIR"
if [ ! -f "$LOG_DIR/api.jsonl" ]; then
  touch "$LOG_DIR/api.jsonl"
  if [ -n "${SUDO_USER:-}" ]; then chown "$SUDO_USER" "$LOG_DIR/api.jsonl"; fi
fi
chmod 644 "$LOG_DIR/api.jsonl"
BACKUP="$AGENT_ETC/datadog.yaml.chargeguard-backup"
if [ ! -f "$BACKUP" ]; then
  cp -p "$AGENT_ETC/datadog.yaml" "$BACKUP"
  chmod 600 "$BACKUP"
fi
if /usr/bin/grep -q '^logs_enabled:' "$AGENT_ETC/datadog.yaml"; then
  /usr/bin/sed -i '' 's/^logs_enabled:.*$/logs_enabled: true/' "$AGENT_ETC/datadog.yaml"
else
  printf '\n# ChargeGuard file log collection\nlogs_enabled: true\n' >> "$AGENT_ETC/datadog.yaml"
fi
mkdir -p "$AGENT_ETC/conf.d/chargeguard.d"
cat > "$AGENT_ETC/conf.d/chargeguard.d/conf.yaml" <<CONFIG
logs:
  - type: file
    path: $LOG_DIR/api.jsonl
    service: chargeguard-api
    source: nodejs
    tags:
      - env:dev
CONFIG
chmod 644 "$AGENT_ETC/conf.d/chargeguard.d/conf.yaml"
/bin/launchctl kickstart -k system/com.datadoghq.agent
echo 'ChargeGuard file log integration installed; Datadog Agent restart requested. No keys or billing settings changed.'
