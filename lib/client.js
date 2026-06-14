const EU_COUNTRIES = ['DE','AT','CH','FR','NL','BE','IT','ES','PL','SE','NO','DK','FI','GB'];

export function createClient(country = 'DE') {
  const baseUrl = EU_COUNTRIES.includes(country)
    ? 'https://ankerpower-api-eu.anker.com'
    : 'https://ankerpower-api.anker.com';

  const baseHeaders = {
    'content-type': 'application/json',
    'model-type':   'DESKTOP',
    'app-name':     'anker_power',
    'os-type':      'android',
    'country':      country,
  };

  async function post(path, body, extraHeaders = {}) {
    const res = await fetch(`${baseUrl}/${path}`, {
      method:  'POST',
      headers: { ...baseHeaders, ...extraHeaders },
      body:    JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${res.statusText} → ${path}\n${text}`);
    }

    const json = await res.json();

    if (json.code !== 0) {
      throw new Error(`API [${json.code}]: ${json.msg ?? 'Unbekannter Fehler'}`);
    }

    return json.data;
  }

  async function postText(path, body, extraHeaders = {}) {
    const res = await fetch(`${baseUrl}/${path}`, {
      method:  'POST',
      headers: { ...baseHeaders, ...extraHeaders },
      body:    JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${res.statusText} → ${path}\n${text}`);
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const json = await res.json();
      if (json.code !== 0) {
        throw new Error(`API [${json.code}]: ${json.msg ?? 'Unbekannter Fehler'}`);
      }
      return json.data;
    }

    return res.text();
  }

  return { post, postText, baseUrl };
}
