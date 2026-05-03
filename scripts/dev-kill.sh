#!/usr/bin/env bash
# Free default Nuxt port(s) and common tvw dev PIDs (darwin / Linux).
set -u
PORTS="${TVW_DEV_PORTS:-3000}"
IFS=',' read -r -a _ports <<< "${PORTS}"
for p in "${_ports[@]}"; do
  p="${p// /}"
  [[ -z "${p}" ]] && continue
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti:"${p}" 2>/dev/null | xargs kill -9 2>/dev/null || true
  fi
done
if command -v pkill >/dev/null 2>&1; then
  pkill -f 'pnpm.*--filter.*tvw-frontend.*dev' 2>/dev/null || true
  pkill -f 'pnpm.*--filter=tvw-frontend.*dev' 2>/dev/null || true
fi
