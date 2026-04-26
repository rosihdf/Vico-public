export type MandantFormSectionActionRowProps = {
  isSaving: boolean
  onCancel: () => void
}

export function MandantFormSectionActionRow({ isSaving, onCancel }: MandantFormSectionActionRowProps) {
  return (
    <div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:flex-wrap">
      <button
        type="submit"
        disabled={isSaving}
        className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-vico-primary text-white font-medium hover:bg-vico-primary-hover disabled:opacity-50 min-h-[44px] sm:min-h-0"
      >
        {isSaving ? 'Speichern…' : 'Speichern'}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 min-h-[44px] sm:min-h-0"
      >
        Abbrechen
      </button>
    </div>
  )
}
