/** Gemeinsame Supabase-Fehlermeldungsübersetzung für alle Vico-Apps */

export const getSupabaseErrorMessage = (error: unknown): string => {
  const msg = (error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String((error as { message?: unknown }).message) : String(error))?.toLowerCase() ?? ''
  if (msg.includes('invalid api key') || msg.includes('api key')) {
    return 'Ungültiger API-Key. Bitte prüfen: 1) Projekt im Supabase-Dashboard → könnte pausiert sein („Restore“ klicken), 2) Anon-Key unter Project Settings → API kopieren, 3) .env aktualisieren und Dev-Server neu starten.'
  }
  if (msg.includes('could not find the table') || msg.includes('schema cache')) {
    return 'Tabelle fehlt. Bitte supabase-complete.sql im Supabase-Dashboard (SQL Editor) ausführen. Siehe Vico.md.'
  }
  // Wichtig: NICHT pauschal auf "violates" prüfen, da das auch Constraint-Fehler
  // (z. B. unique/foreign key) betrifft und fälschlich als RLS gemeldet wurde.
  if (
    msg.includes('row-level security') ||
    msg.includes('rls') ||
    msg.includes('permission denied for table') ||
    msg.includes('42501')
  ) {
    return 'RLS-Fehler: Bist du eingeloggt? Ohne Login geht es nicht. Falls ja: Einstellungen öffnen → „RLS-Fix kopieren“ → Supabase SQL Editor → einfügen → Run.'
  }
  if (msg.includes('violates unique constraint') || msg.includes('duplicate key value')) {
    return 'Datensatz existiert bereits. Bitte Eingaben prüfen.'
  }
  if (msg.includes('violates foreign key constraint')) {
    return 'Verknüpfte Daten fehlen oder wurden bereits gelöscht. Bitte Eingaben aktualisieren.'
  }
  if (msg.includes('jwt') || msg.includes('expired')) {
    return 'Supabase-Session abgelaufen. Bitte aus- und wieder einloggen.'
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'Netzwerkfehler. Internetverbindung prüfen.'
  }
  if (msg.includes('invalid login credentials') || msg.includes('email not confirmed')) {
    return 'Ungültige Anmeldedaten oder E-Mail noch nicht bestätigt. Bei E-Mail-Bestätigung: Posteingang prüfen. Passwort vergessen? → Link unten nutzen.'
  }
  return error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String((error as { message?: unknown }).message) : String(error)
}
