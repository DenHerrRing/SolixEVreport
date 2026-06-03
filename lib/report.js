import { writeFileSync } from 'node:fs';

function formatDateTime(unixSec, timeZone = 'Europe/Zurich') {
  return new Date(unixSec * 1000).toLocaleString('de-DE', {
    timeZone, day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function summaryCards(sessions) {
  const totalKwh  = sessions.reduce((s, x) => s + x.charge_total, 0);
  const totalCost = sessions.reduce((s, x) => s + x.cost, 0);
  const totalCo2  = sessions.reduce((s, x) => s + (x.co2_saving ?? 0), 0);
  return `
    <div class="card"><div class="card-label">Sessions</div><div class="card-value">${sessions.length}</div></div>
    <div class="card"><div class="card-label">Energie</div><div class="card-value">${totalKwh.toFixed(2)} kWh</div></div>
    <div class="card"><div class="card-label">Kosten</div><div class="card-value">${totalCost.toFixed(2)} €</div></div>
    <div class="card"><div class="card-label">CO₂ gespart</div><div class="card-value">${totalCo2.toFixed(1)} kg</div></div>`;
}

function vehicleCards(sessions) {
  const byVehicle = {};
  for (const s of sessions) {
    const name = s.vehicle_name ?? 'Unbekannt';
    if (!byVehicle[name]) byVehicle[name] = { count: 0, kwh: 0, cost: 0 };
    byVehicle[name].count++;
    byVehicle[name].kwh  += s.charge_total;
    byVehicle[name].cost += s.cost;
  }
  return Object.entries(byVehicle).map(([name, v]) => `
    <div class="card">
      <div class="card-label">${name}</div>
      <div class="card-value">${v.kwh.toFixed(2)} kWh</div>
      <div class="card-sub">${v.count} Sessions · ${v.cost.toFixed(2)} €</div>
    </div>`).join('');
}

function sessionRows(sessions, deviceLabels) {
  return [...sessions]
    .sort((a, b) => b.start_time - a.start_time)
    .map(s => {
      const pv = s.charge_from_solar > 0
        ? `<span class="badge pv">PV</span>`
        : `<span class="badge">Netz</span>`;
      return `
      <tr>
        <td class="num muted">${s.transaction_id}</td>
        <td>${formatDateTime(s.start_time, s.time_zone)}</td>
        <td>${formatDateTime(s.end_time, s.time_zone)}</td>
        <td>${s.vehicle_name ?? '–'}</td>
        <td>${deviceLabels[s.device_sn] ?? s.device_sn}</td>
        <td>${pv}</td>
        <td class="num">${s.charge_total.toFixed(2)} kWh</td>
        <td class="num">${formatDuration(s.charge_time)}</td>
        <td class="num">${s.cost.toFixed(2)} €</td>
      </tr>`;
    }).join('');
}

export function writeReport(sessions, { year, month } = {}, deviceLabels = {}, { fetchedAt, deviceSns = [] } = {}, outPath = 'report.html') {
  const period = (month && year)
    ? new Date(year, month - 1).toLocaleString('de-DE', { month: 'long', year: 'numeric' })
    : year ? String(year) : 'Alle Zeiträume';

  const generatedAt = new Date();
  const fmtMeta = (d) => d ? d.toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }) : '–';

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SolixEVreport – Ladebericht ${period}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #f3f4f6; color: #111827; }

    header {
      background: #111827; color: #fff; padding: 2rem 2.5rem;
      display: flex; align-items: baseline; gap: 1rem;
    }
    header h1 { font-size: 1.4rem; font-weight: 600; }
    header span { font-size: 1rem; color: #9ca3af; }

    main { max-width: 1100px; margin: 2rem auto; padding: 0 1.5rem; display: grid; gap: 2rem; }

    section > h2 { font-size: 0.75rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: .08em; color: #6b7280; margin-bottom: .75rem; }

    .cards { display: flex; gap: 1rem; flex-wrap: wrap; }
    .card {
      background: #fff; border-radius: .75rem; padding: 1.25rem 1.5rem;
      flex: 1; min-width: 160px; box-shadow: 0 1px 3px rgba(0,0,0,.08);
    }
    .card-label { font-size: .75rem; color: #6b7280; margin-bottom: .35rem; }
    .card-value { font-size: 1.6rem; font-weight: 700; }
    .card-sub   { font-size: .8rem; color: #6b7280; margin-top: .25rem; }

    table { width: 100%; border-collapse: collapse; background: #fff;
      border-radius: .75rem; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    thead { background: #f9fafb; }
    th { padding: .75rem 1rem; text-align: left; font-size: .75rem; font-weight: 600;
      text-transform: uppercase; letter-spacing: .06em; color: #6b7280; }
    td { padding: .75rem 1rem; font-size: .875rem; border-top: 1px solid #f3f4f6; }
    tr:hover td { background: #f9fafb; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .badge { display: inline-block; padding: .15rem .5rem; border-radius: .35rem;
      font-size: .7rem; font-weight: 600; background: #f3f4f6; color: #6b7280; }
    .badge.pv { background: #dcfce7; color: #16a34a; }
    .muted { color: #9ca3af; }

    footer { margin-top: 1rem; padding: 1.5rem 2.5rem; border-top: 1px solid #e5e7eb;
      font-size: .75rem; color: #9ca3af; display: flex; flex-wrap: wrap; gap: .5rem 2rem; }
    footer strong { color: #6b7280; }
  </style>
</head>
<body>
  <header>
    <h1>SolixEVreport Ladebericht</h1>
    <span>${period}</span>
  </header>
  <main>
    <section>
      <h2>Gesamt</h2>
      <div class="cards">${summaryCards(sessions)}</div>
    </section>
    <section>
      <h2>Nach Fahrzeug</h2>
      <div class="cards">${vehicleCards(sessions)}</div>
    </section>
    <section>
      <h2>Sessions</h2>
      <table>
        <thead>
          <tr>
            <th class="num">TX-ID</th>
            <th>Start</th>
            <th>Ende</th>
            <th>Fahrzeug</th>
            <th>Wallbox</th>
            <th>Quelle</th>
            <th class="num">Energie</th>
            <th class="num">Dauer</th>
            <th class="num">Kosten</th>
          </tr>
        </thead>
        <tbody>${sessionRows(sessions, deviceLabels)}</tbody>
      </table>
    </section>
  </main>
  <footer>
    <span><strong>Bericht erstellt:</strong> ${fmtMeta(generatedAt)}</span>
    <span><strong>Daten abgerufen:</strong> ${fmtMeta(fetchedAt)}</span>
    <span><strong>Geräte:</strong> ${deviceSns.map(sn => `${deviceLabels[sn] ?? sn} (${sn})`).join(' · ') || '–'}</span>
  </footer>
</body>
</html>`;

  writeFileSync(outPath, html, 'utf8');
  return outPath;
}
