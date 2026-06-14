import { writeFileSync } from 'node:fs';
import { authHeaders } from './auth.js';

/**
 * Exportiert Ladesessions als CSV für eine Wallbox.
 *
 * Der Endpoint gibt eine JSON-Antwort mit einer Download-URL zurück.
 * Von dieser URL wird das CSV dann abgerufen.
 *
 * @param {object} client     — createClient()-Instanz
 * @param {object} auth       — login()-Rückgabewert
 * @param {object} options
 * @param {string} options.deviceSn   — Seriennummer der Wallbox
 * @param {string} [options.startDate] — ISO-Datum "YYYY-MM-DD"
 * @param {string} [options.endDate]   — ISO-Datum "YYYY-MM-DD"
 * @returns {Promise<string>} CSV-Inhalt als Text
 */
export async function exportChargeCsv(client, auth, { deviceSn, startDate = '', endDate = '', dateType = 'year' }) {
  if (!deviceSn) throw new Error('deviceSn ist erforderlich für den CSV-Export');

  const result = await client.post(
    'power_service/v1/app/order/export_charge_order',
    { device_sn: deviceSn, date_type: dateType, start_date: startDate, end_date: endDate },
    authHeaders(auth),
  );

  // Anker gibt eine JSON-Antwort mit Download-URL zurück
  const url = result?.url ?? result?.download_url ?? result?.file_url ?? result?.csv_url;
  if (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`CSV-Download fehlgeschlagen: HTTP ${res.status} ${res.statusText}`);
    return res.text();
  }

  // Fallback: Antwort direkt als Text (falls API rohen CSV zurückgibt)
  if (typeof result === 'string') return result;

  throw new Error(`Unerwartetes Antwortformat: ${JSON.stringify(result)}`);
}

/**
 * Schreibt CSV-Inhalt in eine Datei.
 *
 * @param {string} csvText  — CSV-Text
 * @param {string} outPath  — Zieldateipfad
 * @returns {string} outPath
 */
export function writeCsv(csvText, outPath = 'export.csv') {
  writeFileSync(outPath, csvText, 'utf8');
  return outPath;
}
