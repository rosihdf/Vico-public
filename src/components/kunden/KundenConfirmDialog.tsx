import ConfirmDialog from '../ConfirmDialog'

export type KundenConfirmDialogState = {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  variant: 'danger' | 'default'
  onConfirm: () => void
}

export function KundenConfirmDialog({
  state,
  onCancel,
}: {
  state: KundenConfirmDialogState
  onCancel: () => void
}) {
  return (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      variant={state.variant}
      onConfirm={state.onConfirm}
      onCancel={onCancel}
    />
  )
}
