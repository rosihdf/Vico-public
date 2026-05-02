# Capacitor: Schritt-für-Schritt-Anleitung (Android & iOS)

Diese Anleitung beschreibt die **konkrete Umsetzung** der **Haupt-App** (Repo-Root) als native App mit **Capacitor**.  
Voraussetzung: Das Repo enthält bereits `capacitor.config.ts`, `android/` und `ios/` (nach `npx cap add` / früherem Sync).

**Kurzreferenz Konfiguration**

| Einstellung | Wert (Ist) |
|-------------|------------|
| Web-Build-Ordner | `dist/` (`webDir` in `capacitor.config.ts`) |
| Bundle-ID / Paketname | `de.vico.app` (Android `applicationId`, iOS `PRODUCT_BUNDLE_IDENTIFIER`) |
| App-Name (Capacitor) | `ArioVan` (`appName` in `capacitor.config.ts`) |

---

## Teil 0 – Was Capacitor hier macht

1. Ihr baut die Web-App: **`npm run build`** → Ordner **`dist/`** mit HTML, JS, CSS.
2. **`npx cap sync`** kopiert `dist/` in die nativen Projekte und aktualisiert Plugins.
3. **Android Studio** / **Xcode** packen daraus installierbare Apps (APK/AAB bzw. IPA).

Ohne Schritt 1+2 nach Web-Änderungen sehen die Stores **alte** Inhalte.

---

## Teil 1 – Software installieren (einmalig)

### 1.1 Für alle Plattformen

- **Node.js** (z. B. 20 LTS) und **npm**
- Im Projektroot: **`npm ci`** (oder `npm install`)

### 1.2 Nur Android

1. **Android Studio** installieren ([developer.android.com/studio](https://developer.android.com/studio)).
2. Beim ersten Start: **SDK**, **Android SDK Platform** und ein **Emulator-Image** installieren (über SDK Manager / Device Manager).
3. Optional: Umgebungsvariable **`ANDROID_HOME`** (bzw. `ANDROID_SDK_ROOT`) auf den SDK-Pfad setzen – Android Studio zeigt den Pfad unter *Settings → Android SDK*.

### 1.3 Nur iOS (nur auf **macOS**)

1. **Xcode** aus dem Mac App Store.
2. **Xcode Command Line Tools:** `xcode-select --install`
3. Dieses Repo nutzt **Swift Package Manager** (`ios/App/CapApp-SPM`) – **kein** `pod install` nötig. Öffnet Xcode einmal das Projekt, werden Abhängigkeiten automatisch geladen.  
   *(Ältere Capacitor-Vorlagen mit **Podfile**: vor dem ersten Öffnen `cd ios/App && pod install`.)*

---

## Teil 2 – Web-Build und Sync (jedes Mal nach Änderungen an der Web-App)

Im **Projektroot** (`Vico/`):

```bash
npm run build:mobile
```

Das führt aus: **`npm run build`** + **`npx cap sync`**.

**Alternative (gleiche Wirkung):**

```bash
npm run build
npx cap sync
```

**Wann?** Immer, wenn sich etwas an der **Haupt-App** geändert hat (`src/`, `vite.config.ts`, Assets, …) und ihr die **native App** neu testen oder **neu veröffentlichen** wollt.

**Hinweis:** `VITE_*`-Variablen kommen aus eurer **`.env`** / Build-Umgebung beim **`npm run build`** – für Produktion die gleichen Werte nutzen wie auf Netlify.

---

## Teil 3 – Android: lokal testen und Release erstellen

### 3.1 Projekt in Android Studio öffnen

```bash
npm run cap:android
```

Oder Android Studio → **Open** → Ordner **`Vico/android`** (nicht den Repo-Root).

### 3.2 Erstes Einrichten in Android Studio

- Bei Rückfragen: **Trust Project**, Gradle-Sync abwarten (Internet nötig).
- Oben eine **Run Configuration** wählen (z. B. `app`).
- **Gerät:** Emulator starten oder physisches Gerät per USB (USB-Debugging am Handy aktivieren).

### 3.3 App starten (Debug)

- **Run** (grünes Dreieck) – die App sollte eure Web-App aus `dist/` im WebView laden.

### 3.4 Release-Build für Google Play (AAB)

1. In Android Studio: **Build → Generate Signed Bundle / APK → Android App Bundle**.
2. **Keystore** anlegen oder vorhandenen wählen (Passwort sicher verwahren – ohne Keystore kein Update derselben App im Play Store).
3. **release**-Variante wählen → **Finish** → `.aab`-Datei merken.
4. In der **Google Play Console** die AAB hochladen (interner Test → Produktion).

### 3.5 Versionsnummern vor jedem Store-Upload erhöhen

Datei **`android/app/build.gradle`** (bereits vorhanden), in `defaultConfig`:

- **`versionCode`** – **ganze Zahl**, muss bei **jedem** Play-Upload **höher** sein als zuvor (z. B. 1 → 2 → 3).
- **`versionName`** – sichtbar für Nutzer (z. B. `"1.0.1"`), SemVer aus `package.json` spiegeln ist üblich.

Nach Änderung: erneut **`npm run build:mobile`**, dann in Android Studio **neuen** Release-Build erzeugen.

### 3.6 Typische Android-Probleme

| Problem | Lösung |
|---------|--------|
| Gradle-Fehler / SDK fehlt | SDK Manager in Android Studio, fehlende Plattformen installieren |
| Alte Web-Inhalte in der App | `npm run build:mobile` erneut, dann neu bauen |
| Weißer Bildschirm | Konsole in Chrome `chrome://inspect` → WebView inspizieren; oft falsche `base`-URL oder Netzwerk/CORS |

---

## Teil 4 – iOS: lokal testen und Release erstellen

### 4.1 Projekt öffnen (dieses Repo: SPM, kein Pod)

```bash
npm run cap:ios
```

Oder **Xcode → Open** → `Vico/ios/App/App.xcodeproj`  
Beim ersten Öffnen: **Swift Packages** auflösen lassen (Xcode lädt ggf. nach – Internet nötig).

### 4.2 Signing & Team (einmalig pro Apple-Account)

1. Links das **App**-Target auswählen → **Signing & Capabilities**.
2. **Team** eures **Apple Developer**-Accounts wählen (kostenpflichtiges Programm für App Store).
3. **Bundle Identifier** sollte **`de.vico.app`** sein (muss zu App Store Connect / Zertifikaten passen).

### 4.3 Simulator oder Gerät

- Oben **Scheme** `App` und ein **Simulator** (z. B. iPhone 16) oder **echtes Gerät** wählen.
- **Run** (▶) – App lädt die Web-Inhalte aus dem zuletzt gesyncten `dist/`.

### 4.4 Release fürs App Store (Archive)

1. **Product → Destination → Any iOS Device (arm64)** (kein Simulator für Archive).
2. **Product → Archive** warten.
3. **Organizer** öffnet sich → **Distribute App** → **App Store Connect** → Schritt für Schritt (oder **Transporter**-App zum Hochladen der IPA).

### 4.5 Version / Build-Nummer in Xcode

Vor jedem neuen Einreichung:

- **Version** (Marketing, z. B. 1.0.1) und **Build** (Build-Nummer, muss steigen) im Target **General** anpassen – analog zu Android `versionName` / `versionCode`.

### 4.6 Typische iOS-Probleme

| Problem | Lösung |
|---------|--------|
| Swift Package-Fehler | Xcode: **File → Packages → Reset Package Caches** / Netz prüfen |
| Altes Projekt mit **Podfile** | `cd ios/App && pod install`, **`.xcworkspace`** öffnen |
| Signing-Fehler | Team, Bundle ID und Zertifikate in Apple Developer prüfen |
| Alte Web-Inhalte | `npm run build:mobile` + Xcode neu bauen |

---

## Teil 5 – Optional: Dev-Server auf dem Gerät (Live-Reload)

In **`capacitor.config.ts`** könnt ihr (nur für Entwicklung) z. B. eintragen:

```ts
server: {
  url: 'http://192.168.x.x:5173', // eure LAN-IP, npm run dev
  cleartext: true,
},
```

Dann **`npx cap sync`** – die native App lädt **direkt den Vite-Dev-Server** (schnelles Iterieren).  
**Vor Produktions-Build:** `server`-Block **wieder entfernen** oder auskommentieren, sonst braucht die App den Dev-PC im Netzwerk.

---

## Teil 6 – Update-Zyklus (Kurz)

1. Web-Änderungen fertigstellen.
2. **`package.json` `version`** (SemVer) und ggf. **`release-notes.json`** anpassen (wie in `docs/Anleitung-App-Updates-fuer-Betrieb.md`).
3. **`npm run build:mobile`**
4. **Android:** `versionCode` / `versionName` in `android/app/build.gradle` → Signed Bundle bauen → Play Console.
5. **iOS:** Version/Build in Xcode → Archive → App Store Connect.

Nur **Web-Deploy** (Netlify) ohne neuen Store-Upload reicht für Nutzer, die die **Website/PWA** nutzen – **installierte Store-Apps** enthalten gebündeltes `dist/` bis ihr ein **neues** Store-Release einreicht (oder die App lädt bewusst eine Remote-URL – Standard-Capacitor nutzt lokale Assets aus dem Bundle).

---

## Teil 7 – Verknüpfung mit anderen Dokumenten

| Thema | Datei |
|-------|--------|
| Netlify, PWA, PWABuilder | `docs/Netlify-Deployment-Updates-und-Mobile-Apps.md` |
| SemVer & Release Notes | `docs/Anleitung-App-Updates-fuer-Betrieb.md` |
| Kurzüberblick Capacitor | `Vico.md` → „Mobile-Build“ |

---

**Stand:** März 2026 – an die jeweils aktuelle Android-/Xcode-Oberfläche anpassen, falls sich Menüs ändern.
