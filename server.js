import 'dotenv/config';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const PORT = 3000;
const EU   = new Set(['DE','AT','CH','FR','NL','BE','IT','ES','PL','SE','NO','DK','FI','GB']);

function ankerBase(country) {
  return EU.has((country ?? '').toUpperCase())
    ? 'https://ankerpower-api-eu.anker.com'
    : 'https://ankerpower-api.anker.com';
}

// Zufälliges Token pro Server-Start – schützt /config auch im Heimnetz
const CFG_TOKEN = randomBytes(24).toString('hex');

const INDEX = new URL('./index.html', import.meta.url);

const server = createServer(async (req, res) => {
  // Serve index.html – Token wird als JS-Variable eingebettet
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const html = readFileSync(INDEX, 'utf8').replace(
      '</head>',
      `<script>window.__CFG_TOKEN__="${CFG_TOKEN}"</script></head>`,
    );
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // Config aus .env – nur mit gültigem Per-Launch-Token abrufbar
  if (req.method === 'GET' && req.url === '/config') {
    if (req.headers['x-config-token'] !== CFG_TOKEN) {
      res.writeHead(403, { 'content-type': 'text/plain' });
      res.end('Forbidden');
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      email:        process.env.ANKER_EMAIL         ?? '',
      password:     process.env.ANKER_PASSWORD      ?? '',
      country:      process.env.ANKER_COUNTRY       ?? 'DE',
      deviceLabels: process.env.ANKER_DEVICE_LABELS ?? '',
      year:         process.env.ANKER_YEAR          ?? '',
      month:        process.env.ANKER_MONTH         ?? '',
    }));
    return;
  }

  // Proxy: POST /proxy/<anker-api-path>
  if (req.method === 'POST' && req.url.startsWith('/proxy/')) {
    const apiPath = req.url.slice('/proxy/'.length);
    const country = (req.headers['country'] ?? 'DE').toUpperCase();

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);

    const fwdHeaders = {};
    for (const key of ['content-type','model-type','app-name','os-type','country','x-auth-token','gtoken']) {
      if (req.headers[key]) fwdHeaders[key] = req.headers[key];
    }

    try {
      const upstream = await fetch(`${ankerBase(country)}/${apiPath}`, {
        method: 'POST', headers: fwdHeaders, body,
      });
      const upBody = Buffer.from(await upstream.arrayBuffer());
      res.writeHead(upstream.status, {
        'content-type': upstream.headers.get('content-type') ?? 'application/json',
      });
      res.end(upBody);
    } catch (err) {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ code: -1, msg: err.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`SolixEVreport → ${url}`);
  if (process.platform === 'darwin')     execFile('open',     [url]);
  else if (process.platform === 'win32') execFile('cmd',      ['/c', 'start', url]);
  else                                   execFile('xdg-open', [url]);
});
