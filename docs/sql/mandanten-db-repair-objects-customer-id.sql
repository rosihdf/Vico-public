-- -----------------------------------------------------------------------------
-- Repair: public.objects.customer_id NULL, obwohl Zuordnung ableitbar
-- -----------------------------------------------------------------------------
-- Kontext: Constraint objects_bv_or_customer verlangt bv_id ODER customer_id.
-- Legacy/kaputte Zeilen können customer_id leer lassen, während bv_id gesetzt ist.
-- Die App leitet bei Sprung aus Aufträgen per Query mit; dieses Skript bereinigt die DB.
--
-- Ausführung: pro Mandanten-DB (z. B. Rollout laut Mandanten-DB-Workflow), als
-- Rolle mit Schreibrechten auf public.objects (typ. service_role / Migration).
--
-- Idempotent: zweites Mal meist 0 Zeilen betroffen.
-- -----------------------------------------------------------------------------

BEGIN;

-- A) Tür/Tor unter Objekt/BV: Kunde = Kunde des BV
UPDATE public.objects AS o
SET customer_id = b.customer_id,
    updated_at = now()
FROM public.bvs AS b
WHERE o.bv_id = b.id
  AND o.customer_id IS NULL;

-- B) Ohne erfolgreiche A): aus Aufträgen, die diese object_id führen (nur wenn
--    alle passenden Aufträge dieselbe customer_id haben)
UPDATE public.objects AS o
SET customer_id = sub.customer_id,
    updated_at = now()
FROM (
  SELECT
    o2.id,
    min(ord.customer_id) AS customer_id
  FROM public.objects AS o2
  INNER JOIN public.orders AS ord
    ON ord.object_id = o2.id
    OR (ord.object_ids IS NOT NULL AND o2.id = ANY (ord.object_ids))
  WHERE o2.customer_id IS NULL
  GROUP BY o2.id
  HAVING count(DISTINCT ord.customer_id) = 1
) AS sub
WHERE o.id = sub.id;

COMMIT;

-- Optional: Prüfung (nach COMMIT separat ausführen)
-- SELECT id, bv_id, customer_id, internal_id, name
-- FROM public.objects
-- WHERE customer_id IS NULL AND archived_at IS NULL;

