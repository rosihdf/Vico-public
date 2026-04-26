import ConfirmDialog from './ConfirmDialog'

export type AuftragsdetailReopenOrderConfirmDialogProps = {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function AuftragsdetailReopenOrderConfirmDialog({
  open,
  onConfirm,
  onCancel,
}: AuftragsdetailReopenOrderConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title="Auftrag wieder öffnen?"
      message="Der Auftrag wird auf „In Bearbeitung“ gesetzt. Der gespeicherte Monteursbericht (order_completion) und die PDFs bleiben unverändert; Sie können den Vorgang bei Bedarf erneut bearbeiten oder erneut abschließen."
      confirmLabel="Wieder öffnen"
      cancelLabel="Abbrechen"
      variant="default"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
