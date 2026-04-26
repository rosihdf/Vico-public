export type AuftragsdetailMonteurAutoFilledNoticeProps = {
  visible: boolean
}

export function AuftragsdetailMonteurAutoFilledNotice({
  visible,
}: AuftragsdetailMonteurAutoFilledNoticeProps) {
  if (!visible) return null
  return (
    <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
      Automatisch ausgefüllt - weiter
    </div>
  )
}
