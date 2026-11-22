#!/usr/bin/env bash
# Post-deploy smoke: the deploy job runs this against production.
set -euo pipefail
curl -fsS "$BASE_URL/healthz" | grep -q '"ok":true'
echo "smoke ok"
