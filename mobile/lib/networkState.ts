/**
 * Einfaches Modul für den Netzwerkstatus.
 * Wird von SyncContext/NetInfo aktualisiert, von dataService gelesen.
 */
let isOnlineValue = true

export const getIsOnline = () => isOnlineValue

export const setIsOnline = (value: boolean) => {
  isOnlineValue = value
}
