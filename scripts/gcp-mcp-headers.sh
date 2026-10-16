#!/usr/bin/env bash
# headersHelper for Google's managed MCP servers (see .mcp.json).
# Prints a fresh OAuth bearer token from Application Default Credentials; Claude Code re-runs it
# on 401/403, so the 1-hour token expiry is handled automatically.
# Uses the project-scoped ADC dir if present (see SETUP.md), else your normal gcloud ADC.
set -euo pipefail
PROJECT="project-d5fe6dd3-2b61-40b3-932"
ADC_DIR="$HOME/.config/gcloud-hack2skill-adc"
if [[ -f "$ADC_DIR/application_default_credentials.json" ]]; then export CLOUDSDK_CONFIG="$ADC_DIR"; fi
TOKEN="$(gcloud auth application-default print-access-token 2>/dev/null)"
printf '{"Authorization": "Bearer %s", "x-goog-user-project": "%s"}\n' "$TOKEN" "$PROJECT"
