import 'dotenv/config';
import { createClient } from './lib/client.js';
import { login } from './lib/auth.js';
import { fetchAllSessions } from './lib/sessions.js';
import { writeReport } from './lib/report.js';

const EMAIL       = process.env.ANKER_EMAIL;
const PASSWORD    = process.env.ANKER_PASSWORD;
const COUNTRY     = process.env.ANKER_COUNTRY ?? 'DE';
const YEAR  = process.env.ANKER_YEAR  ? parseInt(process.env.ANKER_YEAR)  : null;
const MONTH = process.env.ANKER_MONTH ? parseInt(process.env.ANKER_MONTH) : null;

const DEVICE_LABELS = Object.fromEntries(
  (process.env.ANKER_DEVICE_LABELS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(pair => pair.split(':')),
);
const DEVICE_SNS = Object.keys(DEVICE_LABELS);

if (!EMAIL || !PASSWORD || DEVICE_SNS.length === 0) {
  console.error('Fehlende Umgebungsvariablen. Bitte .env prüfen:');
  console.error('  ANKER_EMAIL, ANKER_PASSWORD, ANKER_DEVICE_LABELS (Format: SN:Label,SN:Label)');
  process.exit(1);
}

const client = createClient(COUNTRY);

console.log(`Anker Solix EV Sessions`);
console.log(`Geräte: ${DEVICE_SNS.join(', ')}`);
console.log(`Server: ${client.baseUrl}\n`);

process.stdout.write('→ Login ...');
const auth = await login(client, EMAIL, PASSWORD, COUNTRY);
console.log(` OK\n`);

process.stdout.write(`→ Sessions abrufen (${DEVICE_SNS.length} Gerät(e)) ...`);
const fetchedAt = new Date();
const results = await Promise.all(
  DEVICE_SNS.map(sn => fetchAllSessions(client, auth, sn, { year: YEAR, month: MONTH })),
);
const sessions = results.flat();
console.log(` OK (${sessions.length} Sessions)\n`);

const reportPath = writeReport(
  sessions,
  { year: YEAR, month: MONTH },
  DEVICE_LABELS,
  { fetchedAt, deviceSns: DEVICE_SNS },
);
console.log(`→ Bericht geschrieben: ${reportPath}`);
