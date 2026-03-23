import { useEffect, useMemo, useState } from 'react'
import { bumpClientConfigVersion } from '../lib/licensePortalService'

type LicenseRow = { id: string; license_number: string; client_config_version: number }

type TenantDeploymentPanelProps = {
  licenses: LicenseRow[]
  /** Mandantenname – für Dateinamen / JSON meta */
  tenantName: string
  /** tenants.supabase_url aus Lizenzportal-DB (kann leer sein) */
  supabaseUrl: string
  appDomain: string
  portalDomain: string
  arbeitszeitDomain: string
  allowedDomainsText: string
  /** Nach erfolgreichem „Push“ Lizenzen neu laden (aktuelle Version anzeigen) */
  onClientPushComplete?: () => void
}

const buildEnvBlock = (lines: { key: string; value: string; comment?: string }[]): string =>
  lines
    .map((l) =>
      l.comment ? `# ${l.comment}\n${l.key}=${l.value}` : `${l.key}=${l.value}`
    )
    .join('\n\n')

const slugifyFile = (s: string): string => {
  const t = s.trim().replace(/[^a-zA-Z0-9äöüÄÖÜß-]+/g, '-').replace(/-+/g, '-')
  return (t || 'mandant').slice(0, 60)
}

const TenantDeploymentPanel = ({
  licenses,
  tenantName,
  supabaseUrl,
  appDomain,
  portalDomain,
  arbeitszeitDomain,
  allowedDomainsText,
  onClientPushComplete,
}: TenantDeploymentPanelProps) => {
  const [selectedLicense, setSelectedLicense] = useState(licenses[0]?.license_number ?? '')
  const [copied, setCopied] = useState<string | null>(null)
  /** false = Host-Lookup (Phase B), kein VITE_LICENSE_NUMBER in Portal-Sites */
  const [includeLicenseNumberInExport, setIncludeLicenseNumberInExport] = useState(true)
  const [pushLoading, setPushLoading] = useState(false)
  const [pushMessage, setPushMessage] = useState<string | null>(null)

  useEffect(() => {
    const nums = licenses.map((l) => l.license_number)
    if (nums.length === 0) return
    if (!nums.includes(selectedLicense)) {
      setSelectedLicense(nums[0])
    }
  }, [licenses, selectedLicense])

  const licenseApiBase = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin.replace(/\/$/, '')}/api`
  }, [])

  const selectedLicenseRow = useMemo(
    () => licenses.find((l) => l.license_number === selectedLicense),
    [licenses, selectedLicense]
  )

  const handlePushClientConfig = async () => {
    const row = selectedLicenseRow
    if (!row?.id) return
    setPushLoading(true)
    setPushMessage(null)
    try {
      const res = await bumpClientConfigVersion(row.id)
      if (res.ok) {
        setPushMessage(
          'Konfigurations-Version erhöht. Eingeloggte Mandanten-Apps holen die Lizenz in der Regel innerhalb von 1–2 Minuten neu (Tab-Fokus beschleunigt).'
        )
        onClientPushComplete?.()
      } else {
        setPushMessage(res.error ?? 'Aktion fehlgeschlagen')
      }
    } catch {
      setPushMessage('Netzwerkfehler')
    } finally {
      setPushLoading(false)
    }
  }

  const supabaseUrlDisplay = useMemo(() => {
    const u = supabaseUrl.trim()
    if (u) return u
    return 'https://<MANDANTEN-PROJEKT-REF>.supabase.co'
  }, [supabaseUrl])

  const mainAppEnv = useMemo(
    () =>
      buildEnvBlock([
        {
          key: 'VITE_SUPABASE_URL',
          value: supabaseUrlDisplay,
          comment: 'Supabase des Mandanten (Dashboard → Settings → API)',
        },
        { key: 'VITE_SUPABASE_ANON_KEY', value: '<ANON-KEY>', comment: 'anon public' },
        {
          key: 'VITE_LICENSE_API_URL',
          value: licenseApiBase || 'https://<admin-site>/api',
          comment: 'Basis-URL Lizenz-API (ohne Slash am Ende)',
        },
      ]),
    [licenseApiBase, supabaseUrlDisplay]
  )

  const portalEnv = useMemo(() => {
    const base: { key: string; value: string; comment?: string }[] = [
      {
        key: 'VITE_SUPABASE_URL',
        value: supabaseUrlDisplay,
        comment: 'gleiches Projekt wie Haupt-App',
      },
      { key: 'VITE_SUPABASE_ANON_KEY', value: '<ANON-KEY>', comment: 'anon public' },
      { key: 'VITE_LICENSE_API_URL', value: licenseApiBase || 'https://<admin-site>/api' },
    ]
    if (includeLicenseNumberInExport) {
      base.push({
        key: 'VITE_LICENSE_NUMBER',
        value: selectedLicense || '<LIZENZNUMMER>',
        comment:
          'optional: weglassen = Host-Lookup (Portal-Domain muss zu Mandant passen); sonst exakt wie Dropdown',
      })
    }
    return buildEnvBlock(base)
  }, [licenseApiBase, selectedLicense, supabaseUrlDisplay, includeLicenseNumberInExport])

  const arbeitszeitEnv = useMemo(() => portalEnv, [portalEnv])

  const checklist = useMemo(
    () =>
      [
        `App-Domain (${appDomain || '…'}) in Netlify der Haupt-App und DNS`,
        portalDomain ? `Kundenportal: ${portalDomain} → Netlify portal-Site + DNS` : 'Kundenportal-Domain eintragen',
        arbeitszeitDomain
          ? `Arbeitszeitenportal: ${arbeitszeitDomain} → Netlify arbeitszeit-Site + DNS`
          : 'Arbeitszeitenportal-Domain eintragen (falls genutzt)',
        'Unter „Domain-Bindung“ / allowed_domains: Hosts der Haupt-App und Portale (eine Zeile pro Host, ohne https://)',
        'Nach Env-Änderungen: Netlify „Clear cache and deploy“',
        'Test: GET {Lizenz-API}/license?licenseNumber=… → 200; optional ohne Nummer im Browser (Host-Lookup)',
        'Automatisierung: docs/Netlify-Mandanten-Env-Skript.md + npm run netlify:apply-env',
      ].join('\n• '),
    [appDomain, portalDomain, arbeitszeitDomain]
  )

  const deploymentJsonExport = useMemo(() => {
    const base = {
      version: 1,
      meta: {
        tenantName: tenantName.trim() || 'Mandant',
        exportedAt: new Date().toISOString(),
        readme:
          'Trage NETLIFY_SITE_IDs ein (Site settings → Site details). Dann: npm run netlify:apply-env -- diese-datei.json',
      },
      licenseApiUrl: licenseApiBase || 'https://<admin-site>/api',
      supabase: {
        url: supabaseUrl.trim() || 'https://<MANDANTEN-PROJEKT-REF>.supabase.co',
        anonKey: '<ANON-KEY>',
      },
      sites: {
        main: { siteId: '' },
        portal: { siteId: '' },
        arbeitszeit: { siteId: '' },
      },
      portalEnv: {
        includeLicenseNumber: includeLicenseNumberInExport,
        ...(includeLicenseNumberInExport && selectedLicense
          ? { licenseNumber: selectedLicense }
          : {}),
      },
      options: {
        dryRun: false,
        markAnonKeyAsSecret: true,
      },
    }
    return JSON.stringify(base, null, 2)
  }, [
    tenantName,
    licenseApiBase,
    supabaseUrl,
    includeLicenseNumberInExport,
    selectedLicense,
  ])

  const envBundleText = useMemo(
    () =>
      [
        '### Vico – Haupt-App (Root, publish: dist)',
        mainAppEnv,
        '',
        '### Kundenportal (Base: portal, publish: portal/dist)',
        portalEnv,
        '',
        '### Arbeitszeitenportal (Base: arbeitszeit-portal)',
        arbeitszeitEnv,
        '',
        '### Checkliste',
        '• ' + checklist,
      ].join('\n'),
    [mainAppEnv, portalEnv, arbeitszeitEnv, checklist]
  )

  const handleCopy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setCopied('error')
    }
  }

  const triggerDownload = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDownloadJson = () => {
    const name = `vico-netlify-deployment-${slugifyFile(tenantName)}-${new Date().toISOString().slice(0, 10)}.json`
    triggerDownload(name, deploymentJsonExport, 'application/json;charset=utf-8')
  }

  const handleDownloadEnvBundle = () => {
    const name = `vico-mandant-env-${slugifyFile(tenantName)}-${new Date().toISOString().slice(0, 10)}.txt`
    triggerDownload(name, envBundleText, 'text/plain;charset=utf-8')
  }

  if (licenses.length === 0) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
        <h3 className="font-semibold text-amber-950">Deployment / Netlify</h3>
        <p className="mt-1">
          Lege mindestens eine Lizenz an – dann erscheinen hier Copy-Paste-Blöcke für die Mandanten-Apps.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/90 p-3 sm:p-4 space-y-4 w-full min-w-0 overflow-hidden">
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-slate-800">Deployment / Netlify</h3>
        <p className="text-sm text-slate-600 mt-1 break-words">
          Vorgefüllte <strong>Umgebungsvariablen</strong> für Netlify (Build). Platzhalter{' '}
          <code className="text-xs bg-white px-1 rounded border">&lt;…&gt;</code> durch Werte aus dem Mandanten-Supabase
          ersetzen. Lizenz-API-URL bezieht sich auf diese Admin-Seite:{' '}
          <code className="text-xs bg-white px-1 rounded border break-all">{licenseApiBase || '…'}</code>
        </p>
      </div>

      {(licenses.length > 1 || selectedLicenseRow) && (
        <div className="space-y-2">
          {licenses.length > 1 && (
            <div>
              <label htmlFor="deploy-license-select" className="block text-sm font-medium text-slate-700 mb-1">
                Lizenz für Portal-Env
              </label>
              <select
                id="deploy-license-select"
                value={selectedLicense}
                onChange={(e) => setSelectedLicense(e.target.value)}
                className="w-full max-w-full sm:max-w-md min-w-0 px-3 py-2 rounded-lg border border-slate-300 text-slate-800 font-mono text-sm"
              >
                {licenses.map((l) => (
                  <option key={l.license_number} value={l.license_number}>
                    {l.license_number}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">Lizenz an Mandanten-Apps signalisieren</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Erhöht die Konfigurations-Version – Haupt-App und Portale pollen die Lizenz-API und laden Features/Design
                  neu, ohne auf das tägliche/wöchentliche Intervall zu warten.
                </p>
                {selectedLicenseRow && (
                  <p className="text-xs text-slate-500 mt-1 font-mono">
                    Aktuelle Version: {selectedLicenseRow.client_config_version}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handlePushClientConfig}
                disabled={pushLoading || !selectedLicenseRow}
                className="shrink-0 px-3 py-2.5 rounded-lg bg-vico-primary text-white text-sm font-medium hover:bg-vico-primary-hover disabled:opacity-50 min-h-[44px] sm:min-h-0"
                aria-label="Lizenzänderung an Mandanten-Apps signalisieren"
              >
                {pushLoading ? 'Sende…' : 'Jetzt signalisieren'}
              </button>
            </div>
            {pushMessage && (
              <p className="text-xs text-slate-700 whitespace-pre-line break-words" role="status">
                {pushMessage}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={includeLicenseNumberInExport}
            onChange={(e) => setIncludeLicenseNumberInExport(e.target.checked)}
            className="rounded border-slate-300"
          />
          <span>
            <code className="text-xs bg-white px-1 rounded border">VITE_LICENSE_NUMBER</code> in Portal/Arbeitszeit-Blöcke
            &amp; JSON
          </span>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleDownloadJson}
          className="flex-1 min-w-[8rem] sm:flex-none px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 hover:bg-slate-50 min-h-[44px] sm:min-h-0 sm:py-1.5"
          aria-label="Deployment-Konfiguration als JSON für Netlify-Skript herunterladen"
        >
          JSON für Skript
        </button>
        <button
          type="button"
          onClick={handleDownloadEnvBundle}
          className="flex-1 min-w-[8rem] sm:flex-none px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 hover:bg-slate-50 min-h-[44px] sm:min-h-0 sm:py-1.5"
          aria-label="Umgebungsvariablen als Textdatei herunterladen"
        >
          .env-Paket (Text)
        </button>
        <p className="text-xs text-slate-500 w-full break-words">
          Skript: <code className="bg-white px-1 rounded border break-all">npm run netlify:apply-env -- datei.json</code> · Doku:{' '}
          <span className="break-words">docs/Netlify-Mandanten-Env-Skript.md</span>
        </p>
      </div>

      <div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2 mb-1 min-w-0">
          <span className="text-sm font-medium text-slate-700 min-w-0 break-words pr-2">Haupt-App (Root-Build)</span>
          <button
            type="button"
            onClick={() => handleCopy('main', mainAppEnv)}
            className="text-sm text-vico-primary hover:underline shrink-0 self-start sm:self-auto min-h-[44px] sm:min-h-0 py-1"
          >
            {copied === 'main' ? 'Kopiert' : 'Kopieren'}
          </button>
        </div>
        <pre className="text-xs bg-white border border-slate-200 rounded-lg p-3 overflow-x-auto max-w-full whitespace-pre-wrap break-words font-mono text-slate-800">
          {mainAppEnv}
        </pre>
      </div>

      <div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2 mb-1 min-w-0">
          <span className="text-sm font-medium text-slate-700 min-w-0 break-words pr-2">Kundenportal (Base: portal)</span>
          <button
            type="button"
            onClick={() => handleCopy('portal', portalEnv)}
            className="text-sm text-vico-primary hover:underline shrink-0 self-start sm:self-auto min-h-[44px] sm:min-h-0 py-1"
          >
            {copied === 'portal' ? 'Kopiert' : 'Kopieren'}
          </button>
        </div>
        <pre className="text-xs bg-white border border-slate-200 rounded-lg p-3 overflow-x-auto max-w-full whitespace-pre-wrap break-words font-mono text-slate-800">
          {portalEnv}
        </pre>
      </div>

      <div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2 mb-1 min-w-0">
          <span className="text-sm font-medium text-slate-700 min-w-0 break-words pr-2">Arbeitszeitenportal (Base: arbeitszeit-portal)</span>
          <button
            type="button"
            onClick={() => handleCopy('az', arbeitszeitEnv)}
            className="text-sm text-vico-primary hover:underline shrink-0 self-start sm:self-auto min-h-[44px] sm:min-h-0 py-1"
          >
            {copied === 'az' ? 'Kopiert' : 'Kopieren'}
          </button>
        </div>
        <pre className="text-xs bg-white border border-slate-200 rounded-lg p-3 overflow-x-auto max-w-full whitespace-pre-wrap break-words font-mono text-slate-800">
          {arbeitszeitEnv}
        </pre>
      </div>

      <div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2 mb-1 min-w-0">
          <span className="text-sm font-medium text-slate-700">Checkliste (Kurz)</span>
          <button
            type="button"
            onClick={() => handleCopy('check', '• ' + checklist)}
            className="text-sm text-vico-primary hover:underline shrink-0 self-start sm:self-auto min-h-[44px] sm:min-h-0 py-1"
          >
            {copied === 'check' ? 'Kopiert' : 'Kopieren'}
          </button>
        </div>
        <p className="text-sm text-slate-700 whitespace-pre-line break-words bg-white border border-slate-200 rounded-lg p-3">
          • {checklist}
        </p>
        {allowedDomainsText.trim() && (
          <p className="mt-2 text-xs text-slate-500 break-words">
            Aktuell hinterlegte Domain-Bindung (Auszug):{' '}
            <span className="font-mono text-slate-700 break-all">{allowedDomainsText.split('\n').filter(Boolean).slice(0, 5).join(', ')}</span>
          </p>
        )}
      </div>
    </section>
  )
}

export default TenantDeploymentPanel
