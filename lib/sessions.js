import { authHeaders } from './auth.js';

export async function getChargeStats(client, auth, deviceSn, dateType = 'month') {
  return client.post(
    'power_service/v1/app/order/get_charge_order_stats',
    { device_sn: deviceSn, date_type: dateType, start_date: '', end_date: '' },
    authHeaders(auth),
  );
}

export async function getChargingSessions(client, auth, deviceSn, { dateType = 'year', startDate = '', endDate = '', page = 0, pageSize = 50 } = {}) {
  return client.post(
    'power_service/v1/app/order/get_charge_order_stats_list',
    {
      device_sn:    deviceSn,
      order_status: 0,
      date_type:    dateType,
      start_date:   startDate,
      end_date:     endDate,
      page,
      page_size:    pageSize,
    },
    authHeaders(auth),
  );
}

export async function getSessionDetail(client, auth, deviceSn, orderId) {
  return client.post(
    'power_service/v1/app/order/get_charging_order_detail',
    { device_sn: deviceSn, order_id: orderId },
    authHeaders(auth),
  );
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
  return { dateType: 'year', startDate: '', endDate: '' };
}

/** Alle Sessions paginiert abrufen, angereichert mit vehicle_name aus dem Session-Detail.
 *  year/month eingrenzen den Zeitraum; ohne Angabe wird das laufende Jahr abgerufen. */
export async function fetchAllSessions(client, auth, deviceSn, { year, month } = {}) {
  const PAGE_SIZE = 50;
  const all = [];
  let page = 0;
  const { dateType, startDate, endDate } = buildDateRange(year, month);

  while (true) {
    const result = await getChargingSessions(client, auth, deviceSn, { dateType, startDate, endDate, page, pageSize: PAGE_SIZE });
    const list = result.order_list ?? [];
    all.push(...list);

    if (all.length >= (result.total ?? 0) || list.length < PAGE_SIZE) break;
    page++;
  }

  const details = await Promise.all(
    all.map(s => getSessionDetail(client, auth, deviceSn, s.order_id).catch(() => null)),
  );

  return all.map((session, i) => ({
    ...session,
    vehicle_name: details[i]?.charge_vehicle_info?.vehicle_name ?? null,
    co2_saving:   details[i]?.co2_saving ?? 0,
  }));
}
