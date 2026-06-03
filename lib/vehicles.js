import { authHeaders } from './auth.js';

export async function getVehicles(client, auth) {
  return client.post(
    'power_service/v1/app/vehicle/get_vehicle_list',
    {},
    authHeaders(auth),
  );
}
