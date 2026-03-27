import type { BV, Customer } from '../types'

export type ResolvedReportDelivery = {
  maintenance_report_email: boolean
  maintenance_report_email_address: string | null
  maintenance_report_portal: boolean
  monteur_report_portal: boolean
  monteur_report_internal_only: boolean
}

/**
 * Effektive Zustell-Einstellungen: Kunde global, BV optional mit eigenen Werten wenn
 * `uses_customer_report_delivery === false`.
 */
export const resolveReportDeliverySettings = (
  customer: Customer | undefined,
  bv: BV | undefined | null
): ResolvedReportDelivery => {
  const c = customer
  if (!c) {
    return {
      maintenance_report_email: true,
      maintenance_report_email_address: null,
      maintenance_report_portal: true,
      monteur_report_portal: true,
      monteur_report_internal_only: false,
    }
  }

  const useCustomer = !bv || bv.uses_customer_report_delivery !== false

  if (useCustomer) {
    const monteurPortal = c.monteur_report_internal_only !== true && c.monteur_report_portal !== false
    return {
      maintenance_report_email: c.maintenance_report_email !== false,
      maintenance_report_email_address: c.maintenance_report_email_address ?? null,
      maintenance_report_portal: c.maintenance_report_portal !== false,
      monteur_report_portal: monteurPortal,
      monteur_report_internal_only: !monteurPortal,
    }
  }

  const monteurPortal = bv!.monteur_report_internal_only !== true && bv!.monteur_report_portal !== false
  return {
    maintenance_report_email: bv!.maintenance_report_email !== false,
    maintenance_report_email_address: bv!.maintenance_report_email_address ?? null,
    maintenance_report_portal: bv!.maintenance_report_portal !== false,
    monteur_report_portal: monteurPortal,
    monteur_report_internal_only: !monteurPortal,
  }
}
