-- Brandschutz-/Normangabe (z. B. T30) für Tür/Tor-Stammdaten; Altbericht C1 & UI.
alter table public.objects add column if not exists anforderung text;
