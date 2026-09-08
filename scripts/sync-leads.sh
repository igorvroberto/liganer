#!/usr/bin/env bash
# Copia a base CRM do radar para o app web (fonte da verdade = GitHub).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/radar-comercial/LEADS.csv"
DST="$ROOT/web/public/data/leads.csv"
mkdir -p "$(dirname "$DST")"
cp "$SRC" "$DST"
echo "Synced $SRC → $DST"
