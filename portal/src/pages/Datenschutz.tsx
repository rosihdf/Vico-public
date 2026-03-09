import { Link } from 'react-router-dom'

const Datenschutz = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 px-4 py-10">
      <article className="w-full max-w-2xl mx-auto bg-white rounded-xl shadow-lg border border-slate-200 p-6 sm:p-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-vico-primary hover:underline mb-6"
          aria-label="Zurück zum Portal"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Zurück
        </Link>

        <h1 className="text-2xl font-bold text-slate-800 mb-6">Datenschutzerklärung</h1>

        <section className="space-y-6 text-sm text-slate-700 leading-relaxed">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">1. Verantwortlicher</h2>
            <p>
              Vico Türen &amp; Tore GmbH<br />
              Malmsheimer Straße 57–59<br />
              71263 Weil der Stadt<br />
              E-Mail: info@vico-tueren.de
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">2. Erhobene Daten</h2>
            <p>
              Im Rahmen der Nutzung dieses Kundenportals werden folgende personenbezogene Daten verarbeitet:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>E-Mail-Adresse (zur Authentifizierung per Magic Link oder Passwort)</li>
              <li>Session-Token (wird lokal im Browser gespeichert, um die Sitzung aufrechtzuerhalten)</li>
              <li>Wartungsberichte (Anzeige der Ihnen zugeordneten Berichte inkl. Kunden-, BV- und Objektdaten)</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">3. Zweck der Verarbeitung</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Authentifizierung und Zugangssteuerung</li>
              <li>Bereitstellung der Wartungsberichte für berechtigte Kunden</li>
              <li>PDF-Download der Wartungsprotokolle</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">4. Rechtsgrundlage</h2>
            <p>
              Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung)
              sowie Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der sicheren Bereitstellung
              des Portals).
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">5. Speicherdauer</h2>
            <p>
              Das Session-Token wird im Browser gespeichert und bei Abmeldung gelöscht. Magic Links
              sind einmalig nutzbar und verfallen automatisch. Ihre E-Mail-Adresse wird gespeichert,
              solange Ihr Portal-Zugang besteht. Wartungsberichte werden gemäß den gesetzlichen
              Aufbewahrungsfristen vorgehalten.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">6. Empfänger und Auftragsverarbeiter</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Supabase Inc.</strong> – Backend-Dienst (Authentifizierung, Datenbank, Dateispeicher).
                Daten werden auf EU-Servern verarbeitet.
              </li>
              <li>
                <strong>Netlify Inc.</strong> – Hosting der Web-Anwendung.
              </li>
            </ul>
            <p className="mt-2">
              Mit beiden Dienstleistern bestehen Auftragsverarbeitungsverträge (AVV) gemäß Art. 28 DSGVO.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">7. Cookies und lokale Speicherung</h2>
            <p>
              Dieses Portal verwendet <strong>keine Cookies von Drittanbietern</strong>, keine
              Analytics- und keine Tracking-Dienste. Für die Authentifizierung wird ein Session-Token
              im lokalen Speicher (localStorage) des Browsers abgelegt. Dies ist technisch notwendig
              und erfordert keine gesonderte Einwilligung.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">8. Ihre Rechte</h2>
            <p>Sie haben gemäß DSGVO folgende Rechte:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Auskunft</strong> (Art. 15) – Welche Daten über Sie gespeichert sind</li>
              <li><strong>Berichtigung</strong> (Art. 16) – Korrektur unrichtiger Daten</li>
              <li><strong>Löschung</strong> (Art. 17) – Entfernung Ihrer Daten</li>
              <li><strong>Einschränkung</strong> (Art. 18) – Einschränkung der Verarbeitung</li>
              <li><strong>Datenübertragbarkeit</strong> (Art. 20) – Erhalt Ihrer Daten in maschinenlesbarem Format</li>
              <li><strong>Widerspruch</strong> (Art. 21) – Widerspruch gegen die Verarbeitung</li>
            </ul>
            <p className="mt-2">
              Zur Ausübung Ihrer Rechte wenden Sie sich bitte an die oben genannte E-Mail-Adresse.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">9. Beschwerderecht</h2>
            <p>
              Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren,
              wenn Sie der Ansicht sind, dass die Verarbeitung Ihrer Daten gegen die DSGVO verstößt.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">10. Automatisierte Entscheidungsfindung</h2>
            <p>
              Es findet keine automatisierte Entscheidungsfindung oder Profilbildung statt.
            </p>
          </div>
        </section>

        <p className="text-xs text-slate-400 mt-8">Stand: März 2026</p>
      </article>
    </div>
  )
}

export default Datenschutz
