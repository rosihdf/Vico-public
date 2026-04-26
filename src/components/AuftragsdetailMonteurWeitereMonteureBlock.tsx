import type { ChangeEvent } from 'react'
import { AppButton, AppInput, AppSelect } from './ui'
import {
  TIME_PICKER_HOURS,
  TIME_PICKER_MINUTES,
  endHourOptionsAfterStart,
  endMinuteOptionsAfterStart,
  getTimeParts,
} from '../lib/auftragsdetailPure'
import { getProfileDisplayName, type Profile } from '../lib/userService'
import type { OrderCompletionExtraV1 } from '../types/orderCompletionExtra'

export type AuftragsdetailMonteurWeitereMonteureBlockProps = {
  zusatzMonteure: OrderCompletionExtraV1['zusatz_monteure']
  profilesForZusatz: Profile[]
  onAddRow: () => void
  onZusatzProfilePick: (index: number, profileId: string) => void
  onZusatzNameChange: (index: number, e: ChangeEvent<HTMLInputElement>) => void
  onZusatzStartHourChange: (index: number, e: ChangeEvent<HTMLSelectElement>) => void
  onZusatzStartMinuteChange: (index: number, e: ChangeEvent<HTMLSelectElement>) => void
  onZusatzEndHourChange: (index: number, e: ChangeEvent<HTMLSelectElement>) => void
  onZusatzEndMinuteChange: (index: number, e: ChangeEvent<HTMLSelectElement>) => void
  onZusatzPauseChange: (index: number, e: ChangeEvent<HTMLInputElement>) => void
}

export function AuftragsdetailMonteurWeitereMonteureBlock({
  zusatzMonteure,
  profilesForZusatz,
  onAddRow,
  onZusatzProfilePick,
  onZusatzNameChange,
  onZusatzStartHourChange,
  onZusatzStartMinuteChange,
  onZusatzEndHourChange,
  onZusatzEndMinuteChange,
  onZusatzPauseChange,
}: AuftragsdetailMonteurWeitereMonteureBlockProps) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Weitere Monteure</span>
        <AppButton type="button" variant="outline" size="sm" onClick={onAddRow}>
          + Zeile
        </AppButton>
      </div>
      <ul className="space-y-3">
        {zusatzMonteure.map((z, i) => (
          <li key={i} className="border border-slate-200 dark:border-slate-600 rounded-lg p-3 space-y-2">
            <AppSelect
              value={z.profile_id ?? ''}
              onChange={(e) => onZusatzProfilePick(i, e.target.value)}
              className="min-w-0 h-9 px-2 py-1 text-sm max-w-full dark:[color-scheme:dark]"
              aria-label={`Mitarbeiter ${i + 1}`}
            >
              <option value="">— Benutzer wählen oder Name unten —</option>
              {profilesForZusatz.map((p) => (
                <option key={p.id} value={p.id}>
                  {getProfileDisplayName(p)}
                </option>
              ))}
            </AppSelect>
            <AppInput
              type="text"
              value={z.name}
              onChange={(e) => onZusatzNameChange(i, e)}
              placeholder="Name"
              className="text-sm"
              aria-label={`Name Mitarbeiter ${i + 1}`}
            />
            <div className="grid grid-cols-3 gap-2">
              <div className="grid grid-cols-2 gap-1">
                <AppSelect
                  value={getTimeParts(z.start).hour}
                  onChange={(e) => onZusatzStartHourChange(i, e)}
                  className="min-w-0 h-9 px-2 py-1 text-base sm:text-sm max-w-full dark:[color-scheme:dark]"
                  aria-label="Beginn Stunde"
                >
                  <option value="">Std</option>
                  {TIME_PICKER_HOURS.map((h) => (
                    <option key={`z-start-h-${i}-${h}`} value={h}>
                      {h}
                    </option>
                  ))}
                </AppSelect>
                <AppSelect
                  value={getTimeParts(z.start).minute}
                  onChange={(e) => onZusatzStartMinuteChange(i, e)}
                  className="min-w-0 h-9 px-2 py-1 text-base sm:text-sm max-w-full dark:[color-scheme:dark]"
                  aria-label="Beginn Minute"
                >
                  <option value="">Min</option>
                  {TIME_PICKER_MINUTES.map((m) => (
                    <option key={`z-start-m-${i}-${m}`} value={m}>
                      {m}
                    </option>
                  ))}
                </AppSelect>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <AppSelect
                  value={getTimeParts(z.end).hour}
                  onChange={(e) => onZusatzEndHourChange(i, e)}
                  className="min-w-0 h-9 px-2 py-1 text-base sm:text-sm max-w-full dark:[color-scheme:dark]"
                  aria-label="Ende Stunde"
                >
                  <option value="">Std</option>
                  {endHourOptionsAfterStart(z.start).map((h) => (
                    <option key={`z-end-h-${i}-${h}`} value={h}>
                      {h}
                    </option>
                  ))}
                </AppSelect>
                <AppSelect
                  value={getTimeParts(z.end).minute}
                  onChange={(e) => onZusatzEndMinuteChange(i, e)}
                  className="min-w-0 h-9 px-2 py-1 text-base sm:text-sm max-w-full dark:[color-scheme:dark]"
                  aria-label="Ende Minute"
                >
                  <option value="">Min</option>
                  {endMinuteOptionsAfterStart(z.start, getTimeParts(z.end).hour).map((m) => (
                    <option key={`z-end-m-${i}-${m}`} value={m}>
                      {m}
                    </option>
                  ))}
                </AppSelect>
              </div>
              <AppInput
                type="number"
                min={0}
                step={15}
                value={z.pause_minuten}
                onChange={(e) => onZusatzPauseChange(i, e)}
                className="min-w-0 h-9 px-2 py-1 text-base sm:text-sm max-w-full dark:[color-scheme:dark]"
                placeholder="Pause"
                aria-label="Pause Minuten"
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
