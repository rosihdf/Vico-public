import { useEffect, useState } from 'react'
import { isOnline } from '../../../shared/networkUtils'
import { fetchDoorFieldCatalog, updateDoorFieldCatalog } from '../../lib/doorFieldCatalog'
import type { ToastType } from '../../ToastContext'

const doorCatalogLinesToList = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean)

export type UseDoorFieldCatalogSectionArgs = {
  userRole: string | null | undefined
  kundenModuleOn: boolean
  showToast: (message: string, type?: ToastType) => void
}

export const useDoorFieldCatalogSection = ({
  userRole,
  kundenModuleOn,
  showToast,
}: UseDoorFieldCatalogSectionArgs) => {
  const [doorCatDoor, setDoorCatDoor] = useState('')
  const [doorCatLockM, setDoorCatLockM] = useState('')
  const [doorCatLockT, setDoorCatLockT] = useState('')
  const [doorCatLoading, setDoorCatLoading] = useState(false)
  const [doorCatSaving, setDoorCatSaving] = useState(false)
  const [doorCatError, setDoorCatError] = useState<string | null>(null)

  useEffect(() => {
    if (userRole !== 'admin' || !kundenModuleOn) return
    let cancelled = false
    setDoorCatLoading(true)
    void fetchDoorFieldCatalog().then((c) => {
      if (cancelled) return
      setDoorCatDoor(c.door_manufacturers.join('\n'))
      setDoorCatLockM(c.lock_manufacturers.join('\n'))
      setDoorCatLockT(c.lock_types.join('\n'))
      setDoorCatLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [userRole, kundenModuleOn])

  const handleSaveDoorFieldCatalog = async () => {
    if (userRole !== 'admin' || !kundenModuleOn || doorCatSaving) return
    if (!isOnline()) {
      setDoorCatError('Nur online speicherbar; bitte Verbindung herstellen.')
      return
    }
    setDoorCatSaving(true)
    setDoorCatError(null)
    const { error } = await updateDoorFieldCatalog({
      door_manufacturers: doorCatalogLinesToList(doorCatDoor),
      lock_manufacturers: doorCatalogLinesToList(doorCatLockM),
      lock_types: doorCatalogLinesToList(doorCatLockT),
    })
    setDoorCatSaving(false)
    if (error) {
      setDoorCatError(error.message)
      return
    }
    showToast('Auswahllisten Tür / Schließmittel gespeichert.', 'success')
  }

  return {
    doorCatDoor,
    setDoorCatDoor,
    doorCatLockM,
    setDoorCatLockM,
    doorCatLockT,
    setDoorCatLockT,
    doorCatLoading,
    doorCatSaving,
    doorCatError,
    handleSaveDoorFieldCatalog,
  }
}
