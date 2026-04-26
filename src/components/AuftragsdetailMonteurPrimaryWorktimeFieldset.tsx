import type { ChangeEvent } from 'react'
import { AppInput, AppSelect, appLabelClassNameSmall } from './ui'
import { TIME_PICKER_HOURS, TIME_PICKER_MINUTES } from '../lib/auftragsdetailPure'
import { AuftragsdetailMonteurPrimaryWorktimeIntro } from './AuftragsdetailMonteurPrimaryWorktimeIntro'
import { AuftragsdetailMonteurPrimaryWorktimeComputedLine } from './AuftragsdetailMonteurPrimaryWorktimeComputedLine'

export type AuftragsdetailMonteurPrimaryWorktimeFieldsetProps = {
  totalMin: number
  primaryStartHour: string
  primaryStartMinute: string
  primaryEndHour: string
  primaryEndMinute: string
  primaryPauseMinuten: number
  primaryEndHourOptions: string[]
  primaryEndMinuteOptions: string[]
  onPrimaryStartHourChange: (e: ChangeEvent<HTMLSelectElement>) => void
  onPrimaryStartMinuteChange: (e: ChangeEvent<HTMLSelectElement>) => void
  onPrimaryEndHourChange: (e: ChangeEvent<HTMLSelectElement>) => void
  onPrimaryEndMinuteChange: (e: ChangeEvent<HTMLSelectElement>) => void
  onPrimaryPauseChange: (e: ChangeEvent<HTMLInputElement>) => void
}

export function AuftragsdetailMonteurPrimaryWorktimeFieldset({
  totalMin,
  primaryStartHour,
  primaryStartMinute,
  primaryEndHour,
  primaryEndMinute,
  primaryPauseMinuten,
  primaryEndHourOptions,
  primaryEndMinuteOptions,
  onPrimaryStartHourChange,
  onPrimaryStartMinuteChange,
  onPrimaryEndHourChange,
  onPrimaryEndMinuteChange,
  onPrimaryPauseChange,
}: AuftragsdetailMonteurPrimaryWorktimeFieldsetProps) {
  return (
    <fieldset className="space-y-3 border border-slate-200 dark:border-slate-600 rounded-lg p-4">
      <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100 px-1">
        Arbeitszeit Monteur (Haupt)
      </legend>
      <AuftragsdetailMonteurPrimaryWorktimeIntro />
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="min-w-0">
          <label htmlFor="wt-start" className="block text-xs text-slate-500 mb-1">
            Beginn
          </label>
          <div className="grid grid-cols-2 gap-2">
            <AppSelect
              id="wt-start-hour"
              value={primaryStartHour}
              onChange={onPrimaryStartHourChange}
              className="min-w-0 h-9 px-2 py-1 text-base sm:text-sm max-w-full dark:[color-scheme:dark]"
              aria-label="Beginn Stunde Hauptmonteur"
            >
              <option value="">Std</option>
              {TIME_PICKER_HOURS.map((h) => (
                <option key={`wt-start-hour-${h}`} value={h}>
                  {h}
                </option>
              ))}
            </AppSelect>
            <AppSelect
              id="wt-start-minute"
              value={primaryStartMinute}
              onChange={onPrimaryStartMinuteChange}
              className="min-w-0 h-9 px-2 py-1 text-base sm:text-sm max-w-full dark:[color-scheme:dark]"
              aria-label="Beginn Minute Hauptmonteur"
            >
              <option value="">Min</option>
              {TIME_PICKER_MINUTES.map((m) => (
                <option key={`wt-start-minute-${m}`} value={m}>
                  {m}
                </option>
              ))}
            </AppSelect>
          </div>
        </div>
        <div className="min-w-0">
          <label htmlFor="wt-end" className="block text-xs text-slate-500 mb-1">
            Ende
          </label>
          <div className="grid grid-cols-2 gap-2">
            <AppSelect
              id="wt-end-hour"
              value={primaryEndHour}
              onChange={onPrimaryEndHourChange}
              className="min-w-0 h-9 px-2 py-1 text-base sm:text-sm max-w-full dark:[color-scheme:dark]"
              aria-label="Ende Stunde Hauptmonteur"
            >
              <option value="">Std</option>
              {primaryEndHourOptions.map((h) => (
                <option key={`wt-end-hour-${h}`} value={h}>
                  {h}
                </option>
              ))}
            </AppSelect>
            <AppSelect
              id="wt-end-minute"
              value={primaryEndMinute}
              onChange={onPrimaryEndMinuteChange}
              className="min-w-0 h-9 px-2 py-1 text-base sm:text-sm max-w-full dark:[color-scheme:dark]"
              aria-label="Ende Minute Hauptmonteur"
            >
              <option value="">Min</option>
              {primaryEndMinuteOptions.map((m) => (
                <option key={`wt-end-minute-${m}`} value={m}>
                  {m}
                </option>
              ))}
            </AppSelect>
          </div>
        </div>
        <div className="min-w-0">
          <label htmlFor="wt-pause" className={appLabelClassNameSmall}>
            Pause (Min.)
          </label>
          <AppInput
            id="wt-pause"
            type="number"
            min={0}
            step={15}
            value={primaryPauseMinuten}
            onChange={onPrimaryPauseChange}
            className="min-w-0 h-9 px-2 py-1 text-base sm:text-sm max-w-full dark:[color-scheme:dark]"
          />
        </div>
      </div>
      <AuftragsdetailMonteurPrimaryWorktimeComputedLine totalMin={totalMin} />
    </fieldset>
  )
}
