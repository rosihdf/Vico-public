export type ChecklistModePolicy = 'selectable' | 'assistant_only' | 'classic_only'

type ResolveChecklistModePolicyArgs = {
  assistantFeatureEnabled: boolean
  /**
   * Vorbereitung für spätere Mandanten-/LP-Policy.
   * Erwartet z. B. "selectable", "assistant_only", "classic_only".
   */
  requestedPolicy?: string | null
}

/**
 * Zentrale Auflösung der Checklisten-Modus-Policy.
 * Solange der Assistent nicht aktiv ist, erzwingen wir klassisch.
 */
export const resolveChecklistModePolicy = ({
  assistantFeatureEnabled,
  requestedPolicy,
}: ResolveChecklistModePolicyArgs): ChecklistModePolicy => {
  if (!assistantFeatureEnabled) return 'classic_only'
  const p = (requestedPolicy ?? '').trim().toLowerCase()
  if (p === 'assistant_only') return 'assistant_only'
  if (p === 'classic_only') return 'classic_only'
  return 'selectable'
}

