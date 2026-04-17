#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${1:-${BASE_URL:-}}"
REAL_TICKER="${REAL_TICKER:-THYAO}"
RUN_ORACLE_SMOKE="${RUN_ORACLE_SMOKE:-0}"

if [[ -z "${BASE_URL}" ]]; then
  echo "Usage: BASE_URL=https://... $0" >&2
  exit 1
fi

python3 - <<'PY' "${BASE_URL}" "${REAL_TICKER}" "${RUN_ORACLE_SMOKE}"
import json
import sys
import urllib.parse
import urllib.request

base_url = sys.argv[1].rstrip("/")
real_ticker = sys.argv[2]
run_oracle_smoke = sys.argv[3] == "1"


def fetch_json(path: str) -> object:
    with urllib.request.urlopen(f"{base_url}{path}") as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return json.loads(response.read().decode(charset))


health = fetch_json("/health")
assert health["status"] == "ok", health

catalog = fetch_json("/v1/indicators/catalog")
assert catalog["count"] > 0, catalog

test_prices = fetch_json("/v1/prices?ticker=TEST&timeframe=1m&limit=2")
assert test_prices["rows"] == 2, test_prices

if run_oracle_smoke:
    query = urllib.parse.urlencode({"ticker": real_ticker, "timeframe": "1d", "limit": 2})
    oracle_prices = fetch_json(f"/v1/prices?{query}")
    assert oracle_prices["rows"] > 0, oracle_prices

print("Smoke tests passed for", base_url)
PY
