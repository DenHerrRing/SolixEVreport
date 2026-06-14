import 'dotenv/config';
import { createClient } from './lib/client.js';
import { login } from './lib/auth.js';
import { exportChargeCsv, writeCsv } from './lib/csv.js';

const EMAIL    = process.env.ANKER_EMAIL;
const PASSWORD = process.env.ANKER_PASSWORD;
const COUNTRY  = process.env.ANKER_COUNTRY ?? 'DE';
const YEAR     = process.env.ANKER_YEAR  ? parseInt(process.env.ANKER_YEAR)  : null;
const MONTH    = process.env.ANKER_MONTH ? parseInt(process.env.ANKER_MONTH) : null;

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

function buildDateRange(year, month) {
  const pad = n => String(n).padStart(2, '0');
  if (year && month) {
    const lastDay = new Date(year, month, 0).getDate();
    return { dateType: 'month', startDate: `${year}-${pad(month)}-01`, endDate: `${year}-${pad(month)}-${lastDay}` };
  }
  if (year) {
    return { dateType: 'year', startDate: `${year}-01-01`, endDate: `${year}-12-31` };
  }
  return { dateType: 'all', startDate: '', endDate: '' };
}

function buildOutPath(label, year, month) {
  const pad = n => String(n).padStart(2, '0');
  const slug = label.replace(/\s+/g, '-');
  if (year && month) return `export-${slug}-${year}-${pad(month)}.csv`;
  if (year)          return `export-${slug}-${year}.csv`;
  return `export-${slug}.csv`;
}

const client = createClient(COUNTRY);

console.log(`Anker Solix CSV Export`);
console.log(`Geräte: ${DEVICE_SNS.map(sn => `${DEVICE_LABELS[sn]} (${sn})`).join(', ')}`);
console.log(`Server: ${client.baseUrl}\n`);

process.stdout.write('→ Login ...');
const auth = await login(client, EMAIL, PASSWORD, COUNTRY);
console.log(' OK\n');

const { dateType, startDate, endDate } = buildDateRange(YEAR, MONTH);
const period = startDate ? `${startDate} – ${endDate}` : 'alle Zeiträume';

for (const deviceSn of DEVICE_SNS) {
  const label = DEVICE_LABELS[deviceSn];
  process.stdout.write(`→ CSV abrufen für ${label} (${period}) ...`);
  const csv = await exportChargeCsv(client, auth, { deviceSn, dateType, startDate, endDate });
  const outPath = buildOutPath(label, YEAR, MONTH);
  writeCsv(csv, outPath);
  console.log(` OK → ${outPath}`);
}
