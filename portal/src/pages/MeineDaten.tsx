import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { fetchPortalUserData } from '../lib/portalService'
import { Link } from 'react-router-dom'
import { useDesign } from '../DesignContext'

const LOESCH_EMAIL = 'info@vico-tueren.de'

type MeineDatenProps = {
  user: User | null
}

const MeineDaten = ({ user }: MeineDatenProps) => {
  const { appName } = useDesign()
  const [data, setData] = useState<{ email: string; customer_names: string[] } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      setIsLoading(true)
      const result = await fetchPortalUserData(user.id)
      setData(result ?? { email: user.email ?? '', customer_names: [] })
      setIsLoading(false)
    }
    load()
  }, [user])

  const handleLoeschantrag = () => {
    const subject = `Antrag auf Löschung meiner Daten – ${appName} Türen & Tore Kundenportal`
    const body = `Sehr geehrtes Team,\n\nhiermit beantrage ich die Löschung meiner personenbezogenen Daten im ${appName} Türen & Tore Kundenportal.\n\nE-Mail-Adresse: ${data?.email ?? ''}\n\nMit freundlichen Grüßen`
    const mailto = `mailto:${LOESCH_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.location.href = mailto
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-vico-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Lade Daten…</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Meine Daten</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Übersicht Ihrer gespeicherten Daten gemäß Art. 15 DSGVO (Auskunftsrecht).
      </p>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <dl className="divide-y divide-slate-100">
          <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">E-Mail-Adresse</dt>
            <dd className="mt-1 text-sm text-slate-800 dark:text-slate-100 sm:mt-0 sm:col-span-2">{data?.email ?? '–'}</dd>
          </div>
          <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Zugeordnete Kunden</dt>
            <dd className="mt-1 text-sm text-slate-800 dark:text-slate-100 sm:mt-0 sm:col-span-2">
              {data?.customer_names && data.customer_names.length > 0 ? (
                <ul className="list-disc pl-5 space-y-1">
                  {data.customer_names.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              ) : (
                '–'
              )}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">Ihre Rechte</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
          Sie haben das Recht auf Auskunft, Berichtigung, Löschung und weitere Rechte. Details finden
          Sie in unserer{' '}
          <Link to="/datenschutz" className="text-vico-primary hover:underline">
            Datenschutzerklärung
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={handleLoeschantrag}
          className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
          aria-label="Löschantrag per E-Mail stellen"
        >
          Löschantrag stellen
        </button>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          Öffnet Ihr E-Mail-Programm mit einer vorausgefüllten Nachricht an {LOESCH_EMAIL}.
        </p>
      </div>
    </div>
  )
}

export default MeineDaten
