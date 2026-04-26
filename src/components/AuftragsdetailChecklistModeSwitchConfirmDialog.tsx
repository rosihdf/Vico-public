import ConfirmDialog from './ConfirmDialog'

export type AuftragsdetailChecklistModeSwitchConfirmDialogProps = {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function AuftragsdetailChecklistModeSwitchConfirmDialog({
  open,
  onConfirm,
  onCancel,
}: AuftragsdetailChecklistModeSwitchConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title="Modus wechseln und neu starten?"
      message="Es wurden bereits Checklistenpunkte bearbeitet. Beim Moduswechsel startet die Checkliste wieder bei Punkt 1."
      confirmLabel="Ja, Modus wechseln"
      cancelLabel="Abbrechen"
      variant="default"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
