# QR-Auftrag: BV-Zusammenfuehrung und Aktionslogik

## Ziel

Der QR-Flow soll transparent und fehlertolerant sein. Nutzer sollen nur die eine Aktion sehen, die in der aktuellen Situation fachlich sinnvoll ist.

## Aktionslogik (Stand Umsetzung)

1. **Aktiver Auftrag auf derselben Tür vorhanden** (`offen` oder `in_bearbeitung`)
   - Sichtbar: **Bestehenden Auftrag öffnen**
   - Unsichtbar: Neuanlage / BV-Zusammenführung

2. **Kein aktiver Tür-Auftrag, aber passender Auftrag in derselben BV vorhanden** (gleicher Typ)
   - Sichtbar: **Zu bestehendem BV-Auftrag hinzufügen**
   - Bei mehreren Kandidaten: Auswahl-Dialog mit Details

3. **Kein aktiver Tür-Auftrag und kein passender BV-Kandidat**
   - Sichtbar: **Neuen Auftrag anlegen**

## Transparenz im Auswahl-Dialog

Pro Kandidat werden angezeigt:

- Auftrags-Kurz-ID
- Auftragstyp
- Status
- Datum
- Anzahl Türen
- Zuweisung (Kurz-ID)
- Kurzbeschreibung

Damit ist klar, in welchen Auftrag die Tür aufgenommen wird.

## Warum kein "Neu erzwingen" mehr

Die Aktion "Sofort neu anlegen" war in der Bedienung missverständlich. Der neue Flow vermeidet doppelte Entscheidungen in der UI und reduziert unnötige Parallelaufträge.

## Zukunft: Zusammenführung verschiedener Auftragstypen

### Modell A (kurzfristig, sicher)
- Zusammenführung nur bei gleichem `order_type`.
- Vorteil: klare Regeln, geringes Fehlerrisiko.

### Modell C (mittelfristig, empfohlen)
- Aufträge bleiben fachlich getrennt, werden aber verknüpft.
- Beispiel: Reparaturauftrag referenziert vorherigen Wartungsauftrag derselben Tür/BV.
- Vorteil: Nachvollziehbarkeit ohne großes Datenmodell-Refactoring.

### Modell B (langfristig, optional)
- Übergeordnetes "Servicepaket" mit Teilaufträgen/Teiltypen.
- Vorteil: weniger Einzelaufträge, aber deutlich größerer Umbau.

## Nächster Schritt (optional)

Wenn Modell C umgesetzt werden soll:

1. leichtes Verknüpfungsfeld im Auftrag (z. B. `related_order_id` / `related_group_id`)
2. Anzeige der Verknüpfungen in Auftragsdetail
3. Filter "verknüpfte Aufträge" in der Auftragsliste

## Bereits umgesetzt (erste Stufe)

- `orders.related_order_id` als optionales Verknüpfungsfeld (Schema in `supabase-complete.sql`)
- `ORDER_COLUMNS` + Typ `Order` erweitert
- Anzeige "Verknüpfter Auftrag" im `Auftragsdetail`
- Folgeauftrag aus Abschlussdialog (`Auftragsdetail`) setzt automatisch `related_order_id` auf den Ursprungsauftrag
- Auftragsliste (`AuftragAnlegen`) zeigt Verknüpfungs-Badge + Verweis und bietet Filter `Verknüpft` / `Ohne Verknüpfung`
