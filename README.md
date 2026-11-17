# SQLForge

SQL für die Klassenarbeit üben: Abfragen schreiben, direkt im Browser ausführen
und Ergebnisse vergleichen. Ohne Konto und ohne Cloud-Datenbank.

[![CI](https://github.com/mehedi-hasan-2426/SQLForge/actions/workflows/ci.yml/badge.svg)](https://github.com/mehedi-hasan-2426/SQLForge/actions/workflows/ci.yml)
[![Security](https://github.com/mehedi-hasan-2426/SQLForge/actions/workflows/security.yml/badge.svg)](https://github.com/mehedi-hasan-2426/SQLForge/actions/workflows/security.yml)
[![MIT](https://img.shields.io/badge/license-MIT-087c78)](LICENSE)

## Was drin ist

- 120 Aufgabenvarianten in acht Gruppen: Filter, Textsuche, Aggregate, `HAVING`,
  Joins, Mengenoperatoren, Unterabfragen und gemischte Aufgaben.
- Zwei Beispieldatenbanken: Global Fast Foods und Arzneimittel.
- SQL-Editor mit Syntaxhervorhebung, Schema-Ansicht und Hinweisen.
- Freies Training, Prüfung und 40-Minuten-Klausursimulation.
- Fehlertraining, Merksätze, Lernfortschritt und JSON-Sicherungen.
- Helle und dunkle Darstellung für Laptop und Smartphone.
- Offline-Cache für App und SQLite-WASM nach vollständigem ersten Laden auf
  `localhost` oder HTTPS.

Eigenständiges Lernprojekt mit synthetischen Daten, keine offizielle
IHK-Prüfungssoftware. Die Aufgaben entstehen aus Vorlagen mit Varianten, nicht aus
120 unterschiedlichen Aufgabentypen. SQLite verwendet für Jahresfilter
`strftime`; die Erklärung zeigt daneben Prüfungssyntax mit `EXTRACT`.

## Lokal starten

Voraussetzungen: Node.js ab 22.12 und npm 10. Das Projekt verwendet npm 10.9.2.
Installationsskripte von Abhängigkeiten sind über [.npmrc](.npmrc) gesperrt.

```powershell
git clone https://github.com/mehedi-hasan-2426/SQLForge.git
cd SQLForge
npm ci --ignore-scripts
npm run dev
```

Öffne die angezeigte Adresse, normalerweise `http://localhost:5173`.

### Smartphone im privaten WLAN

```powershell
npm run dev -- --host 0.0.0.0
```

Öffne am Smartphone die von Vite angezeigte Netzwerkadresse. Laptop und Handy
müssen im selben privaten WLAN sein. Der Laptop-Server muss weiterlaufen.
Mit `Ctrl+C` beenden, keine Router-Portfreigabe einrichten.

HTTP im WLAN erlaubt keinen Offline-Service-Worker auf dem Handy. Dafür brauchst
du HTTPS, zum Beispiel die spätere Vercel-Adresse.

## Checks

```powershell
npm run typecheck
npm test
npm run build
npm audit --audit-level=high
npm run preview
```

Die Produktionsvorschau nutzt dieselben Sicherheitsheader wie die Vercel-Konfiguration.
Bekannte Build-Hinweise betreffen die Bundle-Größe und Node-Module im
plattformübergreifenden sql.js-Paket. Echte Smartphone-Hardware und ein
Vercel-Deployment müssen separat getestet werden.

CI prüft Typen, Tests, Build und npm-Advisories. Der Security-Workflow ergänzt
Gitleaks, CodeQL und bei Pull Requests die Dependency Review. Konfigurierte
Workflows sind noch kein Beleg für erfolgreiche Läufe; die Badges verlinken
die tatsächlichen Ergebnisse.

## Vercel

Noch kein Deployment nötig, um lokal zu lernen. Für die spätere Veröffentlichung:

1. In Vercel **Add New Project** wählen und dieses GitHub-Repo importieren.
2. Repository-Root verwenden. Framework **Vite**.
3. Install: `npm ci --ignore-scripts`; Build: `npm run build`; Ausgabe: `dist`.
4. Node.js 22.x wählen und deployen. Keine Umgebungsvariablen erforderlich.

[vercel.json](vercel.json) enthält diese Einstellungen und die Sicherheitsheader.
Es gibt keinen Server und keine Datenbank zu provisionieren.
Nach dem Deployment SQL-Ausführung, Import/Export, Prüfung und Offline-Neuladen
auch auf dem Handy testen. Vercel kann Hosting-Zugriffsprotokolle führen; SQLForge
enthält selbst keine Analyse- oder Tracking-Skripte.

Die Offline-Version wird erst nach erfolgreicher Service-Worker-Installation
verfügbar. Im Browser prüfen, ob der Worker aktiv ist. Nach einem Update offene
Tabs neu laden. Zum vollständigen Entfernen die Website-Daten im Browser löschen.

## Lernstand und Teilen

Fortschritt bleibt im jeweiligen Browser. **JSON exportieren** erstellt eine
Sicherung; **JSON importieren** liest dieses Format bis maximal 1 MB ein.
Fortschritt wird nicht automatisch zwischen Geräten synchronisiert.

Die Lernhistorie enthält keine eingegebenen SQL-Abfragen. Antworten einer laufenden
Prüfung bleiben bis zur Auswertung lokal gespeichert. Das Löschen des Lernstands
ersetzt keine Löschung bereits heruntergeladener Sicherungen.

Teilen erfolgt nur nach deinem Klick, über die Web Share API, Zwischenablage
oder einen WhatsApp-Link. WhatsApp erhält den freigegebenen Text beim Öffnen
dieses Links. Teile keine persönlichen Daten oder vertraulichen SQL-Abfragen.
Ein `localhost`-Link funktioniert nur auf deinem eigenen Gerät.

## Aufbau

```text
src/data/       Beispieldaten und Aufgaben
src/sql/        SQLite-Worker und Ergebnisvergleich
src/exam/       Aufgabenauswahl und Punkte
src/progress/   Lokaler Lernstand und Importvalidierung
src/share/      Freigabetexte und WhatsApp-Link
src/ui/         React-Oberfläche
public/         Icon und PWA-Manifest
```

React, TypeScript, Vite, CodeMirror, Tailwind und sql.js. Der Build erzeugt einen
Service Worker mit lokalem Asset-Cache; es gibt keine externen CDN-Abhängigkeiten.
SQL läuft ausschließlich gegen eine frische Beispieldatenbank im Worker.

## Mitmachen und Sicherheit

[CONTRIBUTING.md](CONTRIBUTING.md) beschreibt den Ablauf.
Sicherheitsprobleme nicht öffentlich mit Exploit-Details melden:
[SECURITY.md](SECURITY.md).

## Lizenz

MIT, siehe [LICENSE](LICENSE). Hinweise zu Übungsdaten und Drittsoftware:
[NOTICE](NOTICE).
