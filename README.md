# SolixEVreport

Fetches EV charging sessions from the Anker Solix Wallbox API and generates an HTML report with session statistics, vehicle assignment, and CO₂ savings.

![Example Report](./git-assets/examplereport.png "Example Report")

Based on the reverse-engineered Python reference implementation: [thomluther/anker-solix-api](https://github.com/thomluther/anker-solix-api)


## Requirements

- Node.js 18+ (native `fetch` and `crypto` used, no additional runtime dependencies)

## Setup

```bash
npm install
cp .env.example .env   # then fill in your credentials
```

Create a `.env` file with the following variables:

```env
ANKER_EMAIL="your@email.com"
ANKER_PASSWORD="yourpassword"
ANKER_COUNTRY="DE"
ANKER_DEVICE_LABELS="SerialNumber1:Haus,SerialNumber2:Garage"
ANKER_YEAR=2026
ANKER_MONTH=5
```

| Variable | Required | Description |
|---|---|---|
| `ANKER_EMAIL` | ✓ | Anker account email |
| `ANKER_PASSWORD` | ✓ | Anker account password |
| `ANKER_COUNTRY` | | Country code (default: `DE`). Determines EU vs. global API endpoint. |
| `ANKER_DEVICE_LABELS` | ✓ | Comma-separated `SerialNumber:Label` pairs. Serial numbers are used to query the API; labels appear in the report. |
| `ANKER_YEAR` | | Year to report on (e.g. `2026`). Omit for no year filter. |
| `ANKER_MONTH` | | Month to report on (`1`–`12`). Omit or set to `null` for the full year. |
| `ANKER_SITE_ID` | | Site ID for the CSV export (`export-csv.js`). Only needed if your wallboxes are part of an Anker site. |

Multiple devices are supported by comma-separating pairs in `ANKER_DEVICE_LABELS`:
```env
ANKER_DEVICE_LABELS="SN1:Haus,SN2:Garage"
```

## Usage

### Web UI (empfohlen)

```bash
node server.js
```

Startet einen lokalen Webserver auf Port 3000 und öffnet den Browser automatisch. Die Konfiguration wird aus der `.env` geladen — kein manuelles Eintippen nötig.

Der Report ist anschließend unter `http://localhost:3000` erreichbar. Andere Geräte im selben Netzwerk können über `http://<IP>:3000` zugreifen und erhalten dieselbe Konfiguration vom Server.

**Filter im Report (ohne Neuladen):**

| Dropdown | Verhalten |
|---|---|
| Jahr / Monat | Neuer API-Call, Daten werden neu abgerufen |
| Fahrzeug (EV) | Kein API-Call — vorhandene Sessions werden clientseitig gefiltert |

> **Sicherheitshinweis:** Der Endpoint `/config` gibt das Anker-Passwort aus der `.env` an den Browser zurück, damit alle Geräte im Netzwerk ohne manuelle Konfiguration funktionieren. Das Passwort wird dabei direkt im Code übergeben und **nicht** im `localStorage` des Browsers gespeichert. Setze `server.js` daher **niemals** öffentlich ins Internet — er ist ausschließlich für den Einsatz im vertrauenswürdigen Heimnetzwerk gedacht.

### HTML-Report (statisch)

```bash
node index.js
```

Authentifiziert sich, ruft alle Sessions ab und schreibt `report.html` in das Projektverzeichnis.

### CSV-Export

```bash
node export-csv.js
```

Exportiert die Ladesessions als CSV-Datei pro Wallbox. Dateiname richtet sich nach den gesetzten Umgebungsvariablen, z. B. `export-Haus-2026-05.csv`. `ANKER_YEAR` und `ANKER_MONTH` aus der `.env` werden verwendet.

## Report-Inhalt

- **Gesamt** — Sessions, Energie (kWh), Kosten (€), CO₂ gespart (kg)
- **Nach Fahrzeug** — Aufschlüsselung je registriertem Fahrzeug
- **Sessions-Tabelle** — TX-ID, Start/Ende, Fahrzeug, Wallbox, Quelle (PV/Netz), Energie, Dauer, Kosten
- **Footer** — Erstellungszeit, Datenabrufzeit, Geräte-Seriennummern

## Module Structure

```
lib/
  client.js    — HTTP client, EU vs. global API URL selection, proxy support
  auth.js      — Login (ECDH key exchange + AES-256-CBC password encryption)
  sessions.js  — Session list, detail, and paginated fetch
  vehicles.js  — Vehicle list
  report.js    — HTML report generator
  csv.js       — CSV export (export_charge_order endpoint)
index.js          — CLI: fetch sessions + write report.html
server.js         — Local web server: serves index.html + proxies API calls
export-csv.js     — CLI: export sessions as CSV per device
generate-index.js — CLI: fetch sessions + write index.html (static)
index.html        — Browser UI: login form, live data fetch, interactive report
```

## License
LGPL v3 – © Dennis Hering. Modifications must remain open source.
