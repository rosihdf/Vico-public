import MaintenanceContractModal from '../MaintenanceContractModal'
import type { MaintenanceContract } from '../../types'

export type KundenMaintenanceContractModalBridgeProps = {
  open: boolean
  customerId: string | null
  bvId: string | null
  contract: MaintenanceContract | null
  onClose: () => void
  onSuccess: () => void
}

export function KundenMaintenanceContractModalBridge(props: KundenMaintenanceContractModalBridgeProps) {
  return <MaintenanceContractModal {...props} />
}
