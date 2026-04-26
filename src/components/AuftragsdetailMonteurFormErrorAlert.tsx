export type AuftragsdetailMonteurFormErrorAlertProps = {
  message: string | null
}

export function AuftragsdetailMonteurFormErrorAlert({
  message,
}: AuftragsdetailMonteurFormErrorAlertProps) {
  if (!message) return null
  return (
    <p
      className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg p-2"
      role="alert"
    >
      {message}
    </p>
  )
}
