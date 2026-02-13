#!/bin/sh
set -eu

REPO_DIR="/mnt/Apps/BetterAtlas"
NODE_BIN="/root/.nvm/versions/node/v20.20.0/bin/node"
JOB_JS="$REPO_DIR/api/dist/jobs/atlasSync.js"
LOCK_FILE="/tmp/atlas-sync.lock"
LOG_FILE="/var/log/atlas-sync.log"

cd "$REPO_DIR"

# Prevent overlapping runs (cron can start a new run even if the previous hasn't finished).
/usr/bin/flock -n "$LOCK_FILE" "$NODE_BIN" "$JOB_JS" >>"$LOG_FILE" 2>&1

