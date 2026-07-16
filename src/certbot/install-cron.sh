#!/bin/sh
# Merges crontab (this directory's cron entry) into the current user's crontab, without
# touching any other jobs already there — this VPS runs cron for other projects too, so
# plain `crontab < file` (which replaces the whole crontab) would be destructive here.
# Idempotent: re-running this after the entry already exists updates it in place instead
# of adding a duplicate, by stripping any prior line that mentions this project's
# renew.sh path before appending the current one.
set -eu
cd "$(dirname "$0")"

MARKER="certbot/renew.sh"

{
  crontab -l 2>/dev/null | grep -vF "$MARKER" || true
  cat crontab
} | crontab -

echo "Installed. Current crontab:"
crontab -l
