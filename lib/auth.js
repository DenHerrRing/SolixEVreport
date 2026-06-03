import crypto from 'node:crypto';

// Hardcoded Anker server ECDH public key (aus Python-Source: session.py)
const SERVER_PUBLIC_KEY_HEX =
  '04c5c00c4f8d1197cc7c3167c52bf7acb054d722f0ef08dcd7e0883236e0d72a3' +
  '868d9750cb47fa4619248f3d83f0f662671dadc6e2d31c2f41db0161651c7c076';

function buildClientKeys() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const clientPubKeyHex = ecdh.getPublicKey('hex');
  const sharedSecret = ecdh.computeSecret(Buffer.from(SERVER_PUBLIC_KEY_HEX, 'hex'));
  return { clientPubKeyHex, sharedSecret };
}

function encryptPassword(password, sharedSecret) {
  // AES-256-CBC: Key = Shared Secret (32 Bytes), IV = erste 16 Bytes des Shared Secret
  // Kein IV-Prefix im Output – Server leitet IV ebenfalls aus dem Shared Secret ab
  const key    = sharedSecret.slice(0, 32);
  const iv     = sharedSecret.slice(0, 16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const enc    = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return enc.toString('base64');
}

export function authHeaders(auth) {
  return {
    'x-auth-token': auth.token,
    'gtoken':       auth.gtoken,
  };
}

export async function login(client, email, password, country = 'DE') {
  const { clientPubKeyHex, sharedSecret } = buildClientKeys();
  const tzOffsetMs = -new Date().getTimezoneOffset() * 60 * 1000;

  const data = await client.post('passport/login', {
    ab:                 country,
    client_secret_info: { public_key: clientPubKeyHex },
    enc:                0,
    email,
    password:           encryptPassword(password, sharedSecret),
    time_zone:          tzOffsetMs,
    transaction:        String(Date.now()),
  });

  return {
    token:  data.auth_token,
    gtoken: crypto.createHash('md5').update(data.user_id).digest('hex'),
  };
}
