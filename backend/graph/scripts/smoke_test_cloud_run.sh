#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${1:-${BASE_URL:-}}"

if [[ -z "${BASE_URL}" ]]; then
  echo "Usage: smoke_test_cloud_run.sh https://YOUR_SERVICE_URL" >&2
  exit 1
fi

python3 - "${BASE_URL}" <<'PY'
import json
import sys
import urllib.request

base = sys.argv[1].rstrip("/")

def fetch(path: str):
    req = urllib.request.Request(base + path, headers={"User-Agent": "evalon-graph-smoke-test"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.status, resp.read().decode("utf-8")

status, body = fetch("/health")
assert status == 200, f"/health returned {status}"
payload = json.loads(body)
assert payload.get("status") == "ok", payload

status, body = fetch("/chart.html?symbol=ADEL&tf=1d")
assert status == 200, f"/chart.html returned {status}"
assert "Graph Chart" in body, body[:200]

status, body = fetch("/chart?symbol=ADEL&tf=1d")
assert status == 200, f"/chart returned {status}"
assert "Graph Chart" in body, body[:200]

status, body = fetch("/api/v1/candles?symbol=ADEL&tf=1d&limit=2")
assert status == 200, f"/api/v1/candles returned {status}"
candles = json.loads(body)
assert len(candles.get("data", [])) > 0, candles

status, body = fetch("/api/v1/indicators?symbol=ADEL&tf=1d&strategy=rsi&period=14&limit=60")
assert status == 200, f"/api/v1/indicators returned {status}"
indicators = json.loads(body)
assert "indicators" in indicators, indicators

status, body = fetch("/api/v1/backtests/catalog/rules")
assert status == 200, f"/api/v1/backtests/catalog/rules returned {status}"

print(f"Smoke tests passed for {base}")
PY
