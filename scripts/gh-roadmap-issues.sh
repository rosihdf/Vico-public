#!/usr/bin/env bash
# Erstellt GitHub-Issues für Vico.md §7.2 (Roadmap).
# Voraussetzung: gh installiert und gh auth login
# Nutzung: ./scripts/gh-roadmap-issues.sh [--dry-run]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DRY=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY=true
fi

if ! command -v gh >/dev/null 2>&1; then
  if [[ "$DRY" == true ]]; then
    echo "Hinweis: gh nicht installiert – Dry-Run zeigt nur die geplanten Befehle." >&2
  else
    echo "Bitte GitHub CLI installieren: https://cli.github.com/ (z. B. brew install gh)" >&2
    exit 1
  fi
fi

cd "$ROOT"

ensure_labels() {
  gh label create roadmap --color "0366d6" --description "Vico Roadmap §7.2" 2>/dev/null || true
  gh label create lizenzportal --color "5319E7" --description "Lizenzportal-Admin" 2>/dev/null || true
  gh label create hauptapp --color "0E8A16" --description "Haupt-App Vico" 2>/dev/null || true
  gh label create mobile --color "FBCA04" --description "Capacitor / mobil" 2>/dev/null || true
}

create_one() {
  local title="$1"
  local body_file="$2"
  shift 2
  local labels=("$@")

  if [[ ! -f "$body_file" ]]; then
    echo "Fehlt: $body_file" >&2
    return 1
  fi

  if [[ "$DRY" == true ]] || ! command -v gh >/dev/null 2>&1; then
    echo "[DRY-RUN] gh issue create --title \"$title\" --body-file \"$body_file\" --label ${labels[*]}"
    return 0
  fi

  local args=(issue create --title "$title" --body-file "$body_file")
  local l
  for l in "${labels[@]}"; do
    args+=(--label "$l")
  done
  gh "${args[@]}"
}

if [[ "$DRY" == false ]] && command -v gh >/dev/null 2>&1; then
  ensure_labels
fi

# Titel müssen eindeutig sein – Präfix [ID]
create_one "[L4] Logo-Upload im Lizenzportal (Storage, WebP, Vorschau)" \
  "$ROOT/docs/github-issues/L4.body.md" roadmap lizenzportal

create_one "[J10] Bug-Erfassungsmodul (System → Fehlerberichte)" \
  "$ROOT/docs/github-issues/J10.body.md" roadmap hauptapp

create_one "[J4] Schnellzugriff / Zuletzt bearbeitet (Startseite)" \
  "$ROOT/docs/github-issues/J4.body.md" roadmap hauptapp

create_one "[J3] Export Buchhaltung (CSV/Excel)" \
  "$ROOT/docs/github-issues/J3.body.md" roadmap hauptapp

create_one "[J2] Wartungsstatistik / Auswertung" \
  "$ROOT/docs/github-issues/J2.body.md" roadmap hauptapp

create_one "[J1] Wartungsplanung inkl. E-Mail-Erinnerungen (teilweise)" \
  "$ROOT/docs/github-issues/J1.body.md" roadmap hauptapp

create_one "[J6] Umbau Wartung MVP (Freigabe, Portal, DIN/ASR) – Epic" \
  "$ROOT/docs/github-issues/J6.body.md" roadmap hauptapp

create_one "[J7] Paket: Mängel-Follow-up, iCal, Bulk, Portal-Push" \
  "$ROOT/docs/github-issues/J7.body.md" roadmap hauptapp

create_one "[I2] Optional: Bluetooth-Drucker (QR-Etiketten)" \
  "$ROOT/docs/github-issues/I2.body.md" roadmap mobile

if [[ "$DRY" == true ]]; then
  echo ""
  echo "Dry-Run beendet. Ohne --dry-run ausführen, um Issues anzulegen."
else
  echo ""
  echo "Fertig. Issues anzeigen: gh issue list --label roadmap"
fi
