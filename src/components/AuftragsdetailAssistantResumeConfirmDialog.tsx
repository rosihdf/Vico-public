import ConfirmDialog from './ConfirmDialog'

export type AuftragsdetailAssistantResumeConfirmDialogProps = {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function AuftragsdetailAssistantResumeConfirmDialog({
  open,
  onConfirm,
  onCancel,
}: AuftragsdetailAssistantResumeConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title="Fortsetzen oder neu starten?"
      message="Für diesen Auftrag gibt es bereits gespeicherte oder lokal bearbeitete Checklisten-Einträge."
      confirmLabel="Fortsetzen"
      cancelLabel="Neu starten"
      variant="default"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
