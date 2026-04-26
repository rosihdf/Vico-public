import { getUsageLevel, getUsageMessage } from '../../lib/licenseService'

export type KundenLicenseUsageBannerProps = {
  customerCountForLicense: number
  maxCustomers: number | null | undefined
}

export const KundenLicenseUsageBanner = ({
  customerCountForLicense,
  maxCustomers,
}: KundenLicenseUsageBannerProps) => {
  if (maxCustomers == null) return null
  const msg = getUsageMessage(customerCountForLicense, maxCustomers, 'Kunden')
  const level = getUsageLevel(customerCountForLicense, maxCustomers)
  if (!msg) return null
  return (
    <div
      className={`mb-4 p-4 rounded-xl border ${
        level === 'blocked'
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-800 dark:text-red-300'
          : level === 'critical'
            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300'
            : 'bg-amber-50/80 dark:bg-amber-900/10 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300'
      }`}
      role="status"
    >
      <p className="text-sm font-medium">{msg}</p>
    </div>
  )
}
