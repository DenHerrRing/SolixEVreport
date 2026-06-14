import 'dotenv/config';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { randomBytes, createECDH, createCipheriv, createHash } from 'node:crypto';

const SERVER_PUB = '04c5c00c4f8d1197cc7c3167c52bf7acb054d722f0ef08dcd7e0883236e0d72a3868d9750cb47fa4619248f3d83f0f662671dadc6e2d31c2f41db0161651c7c076';

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

  // Login: POST /login – ECDH + AES server-seitig (crypto.subtle fehlt bei LAN-HTTP)
  if (req.method === 'POST' && req.url === '/login') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    let email, password, country, tzOffset;
    try {
      ({ email, password, country, tzOffset } = JSON.parse(Buffer.concat(chunks)));
    } catch {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Ungültige Anfrage' }));
      return;
    }
    country = (country ?? 'DE').toUpperCase();
    try {
      const ecdh = createECDH('prime256v1');
      ecdh.generateKeys();
      const clientPubHex = ecdh.getPublicKey('hex');
      const shared = ecdh.computeSecret(Buffer.from(SERVER_PUB, 'hex'));
      const cipher = createCipheriv('aes-256-cbc', shared.slice(0, 32), shared.slice(0, 16));
      const encPw = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]).toString('base64');
      const upstream = await fetch(`${ankerBase(country)}/passport/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'model-type': 'DESKTOP', 'app-name': 'anker_power', 'os-type': 'android', 'country': country },
        body: JSON.stringify({
          ab: country,
          client_secret_info: { public_key: clientPubHex },
          enc: 0, email, password: encPw,
          time_zone:   tzOffset ?? 0,
          transaction: String(Date.now()),
        }),
      });
      const json = await upstream.json();
      if (json.code !== 0) {
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: `API [${json.code}]: ${json.msg ?? 'Login fehlgeschlagen'}` }));
        return;
      }
      const token  = json.data.auth_token;
      const gtoken = createHash('md5').update(json.data.user_id).digest('hex');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ token, gtoken }));
    } catch (err) {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
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
  // Browser öffnen – Fehler ignorieren (kein Display in Docker/CI)
  const noop = () => {};
  if (process.platform === 'darwin')     execFile('open',     [url], noop);
  else if (process.platform === 'win32') execFile('cmd',      ['/c', 'start', url], noop);
  else                                   execFile('xdg-open', [url], noop);
});
