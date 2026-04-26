import type { ChangeEvent } from 'react'
import type { ToastType } from '../../ToastContext'
import { useDoorFieldCatalogSection } from './useDoorFieldCatalogSection'

export type DoorFieldCatalogSettingsSectionProps = {
  visible: boolean
  userRole: string | null | undefined
  kundenModuleOn: boolean
  showToast: (message: string, type?: ToastType) => void
  doorStammdatenListsEnabled: boolean
  doorStammdatenCheckboxDisabled: boolean
  onDoorStammdatenCheckboxChange: (e: ChangeEvent<HTMLInputElement>) => void | Promise<void>
}

export const DoorFieldCatalogSettingsSection = ({
  visible,
  userRole,
  kundenModuleOn,
  showToast,
  doorStammdatenListsEnabled,
  doorStammdatenCheckboxDisabled,
  onDoorStammdatenCheckboxChange,
}: DoorFieldCatalogSettingsSectionProps) => {
  const {
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
  } = useDoorFieldCatalogSection({ userRole, kundenModuleOn, showToast })

  if (!visible) return null

  return (
    <section
      className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
      aria-labelledby="door-field-catalog-heading"
    >
      <h3 id="door-field-catalog-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
        Tür / Schließmittel (Auswahllisten)
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
        Eine Zeile pro Eintrag. Die Listen erscheinen in den Stammdaten der Tür/Tore als Dropdown, sofern unten
        „Auswahllisten in Stammdaten aktiv“ eingeschaltet ist.
      </p>
      <label className="flex items-center justify-between gap-4 py-2 mb-3 border-b border-slate-200 dark:border-slate-600 cursor-pointer">
        <span className="text-sm text-slate-700 dark:text-slate-200">Auswahllisten in Stammdaten aktiv</span>
        <input
          type="checkbox"
          checked={doorStammdatenListsEnabled}
          disabled={doorStammdatenCheckboxDisabled}
          onChange={(e) => void onDoorStammdatenCheckboxChange(e)}
          className="w-5 h-5 rounded border-slate-300 dark:border-slate-500 text-vico-primary focus:ring-vico-primary disabled:opacity-50"
          aria-label={
            doorStammdatenListsEnabled
              ? 'Auswahllisten in Stammdaten deaktivieren'
              : 'Auswahllisten in Stammdaten aktivieren'
          }
        />
      </label>
      {!doorStammdatenListsEnabled ? (
        <p
          className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/30 px-3 py-2 rounded-lg mb-3"
          role="status"
        >
          Deaktiviert: In Tür/Tor-Stammdaten erscheinen nur Freitextfelder (keine Dropdowns).
        </p>
      ) : null}
      {doorCatLoading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Lade Katalog…</p>
      ) : (
        <div className="space-y-3 mb-4">
          <div>
            <label htmlFor="door-cat-manufacturers" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Tür-Hersteller
            </label>
            <textarea
              id="door-cat-manufacturers"
              value={doorCatDoor}
              onChange={(e) => setDoorCatDoor(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm"
              placeholder="z. B. Mustermann GmbH"
              aria-label="Liste Tür-Hersteller, eine Zeile pro Eintrag"
            />
          </div>
          <div>
            <label htmlFor="door-cat-lock-m" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Schließmittel Hersteller
            </label>
            <textarea
              id="door-cat-lock-m"
              value={doorCatLockM}
              onChange={(e) => setDoorCatLockM(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm"
              aria-label="Liste Schließmittel-Hersteller"
            />
          </div>
          <div>
            <label htmlFor="door-cat-lock-t" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Schließmittel Typ
            </label>
            <textarea
              id="door-cat-lock-t"
              value={doorCatLockT}
              onChange={(e) => setDoorCatLockT(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm"
              aria-label="Liste Schließmittel-Typen"
            />
          </div>
        </div>
      )}
      {doorCatError ? (
        <p className="text-sm text-red-600 dark:text-red-400 mb-2" role="alert">
          {doorCatError}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void handleSaveDoorFieldCatalog()}
        disabled={doorCatSaving || doorCatLoading}
        className="inline-flex px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
      >
        {doorCatSaving ? 'Speichern…' : 'Auswahllisten speichern'}
      </button>
    </section>
  )
}
