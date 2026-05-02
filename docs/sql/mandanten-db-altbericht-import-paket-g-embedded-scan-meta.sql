-- Paket G: optionale Scan-Metadaten für eingebettete PDF-Bilder (Logo-/Header-Heuristik).
-- Nach Paket E/F ausführen; App nutzt die Spalte, wenn vorhanden.

alter table public.altbericht_import_embedded_image
  add column if not exists scan_meta_json jsonb;

comment on column public.altbericht_import_embedded_image.scan_meta_json is
  'Optional: Pixelmaße, Fingerprint, logoLikelihood (none|suspect|likely), Gründe — Scan pdfjs_operator_v2_logo_meta.';
