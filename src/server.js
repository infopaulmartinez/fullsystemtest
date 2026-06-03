/**
 * Cashmatic Proxy Szerver – Szemesi Pékség Kft.
 * Port: 3001
 * Indítás: node server.js
 *
 * FIX: A Cashmatic eszköz API MINDEN endpointja POST-ot vár,
 *      még az olvasó műveletek is (ActiveTransaction, AllLevels, stb.)
 *      → deviceGet() helyett devicePost({}, token) kell mindenhol.
 */

import express from 'express';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';
import https from 'https';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// CORS – minden origin engedélyezve (admin + POS)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// SSL – helyi eszköz, önaláírt cert kihagyva
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// ─── Eszköz konfigurációk (devices.json + .env default) ──────────────────────

const DEVICES_FILE = path.join(__dirname, 'devices.json');

function loadDeviceConfigs() {
  try {
    if (fs.existsSync(DEVICES_FILE)) return JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf8'));
  } catch {}
  return {};
}

function saveDeviceConfigs(configs) {
  fs.writeFileSync(DEVICES_FILE, JSON.stringify(configs, null, 2));
}

let deviceConfigs = loadDeviceConfigs();

// Alapértelmezett eszköz .env-ből
if (!deviceConfigs['default']) {
  deviceConfigs['default'] = {
    id:       'default',
    name:     'Főpénztár',
    ip:       process.env.CASHMATIC_SERVER_IP,
    port:     process.env.CASHMATIC_PORT,
    protocol: process.env.CASHMATIC_PROTOCOL || 'https',
    username: process.env.CASHMATIC_USERNAME,
    password: process.env.CASHMATIC_PASSWORD,
  };
  saveDeviceConfigs(deviceConfigs);
}

// ─── Session kezelés eszközönként ─────────────────────────────────────────────

const sessions = {}; // { deviceId: { token, lastRefresh } }

function getHost(deviceId) {
  const cfg = deviceConfigs[deviceId];
  if (!cfg) throw new Error(`Ismeretlen eszköz: ${deviceId}`);
  return `${cfg.protocol}://${cfg.ip}:${cfg.port}`;
}

// POST kérés body-val (login, start-payment, stb.)
async function devicePost(deviceId, endpoint, body, token) {
  const url = getHost(deviceId) + endpoint;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await axios.post(url, body, { httpsAgent, headers });
  return res.data;
}

// !! FONTOS !!
// A Cashmatic API minden "olvasó" endpointja is POST-ot vár (nem GET).
// Ezért deviceGet() helyett devicePost(deviceId, endpoint, {}, token) kell.
// deviceGet() el van távolítva – ne add vissza, mert 405-öt okoz.

async function loginDevice(deviceId) {
  const cfg = deviceConfigs[deviceId];
  if (!cfg) return false;
  try {
    const result = await devicePost(deviceId, '/api/user/Login', {
      username: cfg.username,
      password: cfg.password,
    }, null);
    if (result.code === 0) {
      sessions[deviceId] = { token: result.data.token, lastRefresh: new Date() };
      console.log(`✅ Login OK: ${cfg.name} (${deviceId})`);
      return true;
    }
    console.error(`❌ Login sikertelen (${deviceId}):`, result.message);
    return false;
  } catch (e) {
    console.error(`❌ Login hiba (${deviceId}):`, e.message);
    return false;
  }
}

async function ensureLoggedIn(deviceId = 'default') {
  if (sessions[deviceId]?.token) return true;
  return await loginDevice(deviceId);
}

// Token megújítás 9 percenként (minden aktív eszközre)
// FIX: RenewToken is POST, nem GET!
setInterval(async () => {
  for (const [deviceId, session] of Object.entries(sessions)) {
    if (!session.token) continue;
    try {
      const result = await devicePost(deviceId, '/api/user/RenewToken', {}, session.token);
      if (result.code === 0) {
        session.token = result.data.token;
        session.lastRefresh = new Date();
        console.log(`🔄 Token megújítva: ${deviceId}`);
      } else {
        session.token = null;
      }
    } catch { session.token = null; }
  }
}, 9 * 60 * 1000);

// ─── Helper ───────────────────────────────────────────────────────────────────

function getDeviceId(req) {
  return req.query.deviceId || req.body?.deviceId || 'default';
}

// ─── Eszköz config API ────────────────────────────────────────────────────────

app.get('/api/devices', (req, res) => {
  const safe = Object.values(deviceConfigs).map(({ id, name, ip, port, protocol, username }) => ({
    id, name, ip, port, protocol, username
  }));
  res.json({ success: true, data: safe });
});

app.post('/api/devices', (req, res) => {
  const { id, name, ip, port, protocol = 'https', username, password } = req.body;
  if (!id || !name || !ip || !port || !username || !password)
    return res.status(400).json({ success: false, message: 'Hiányzó mezők: id, name, ip, port, username, password' });
  if (deviceConfigs[id] && id === 'default')
    return res.status(400).json({ success: false, message: 'Az alap eszköz ID fenntartott' });
  deviceConfigs[id] = { id, name, ip, port, protocol, username, password };
  saveDeviceConfigs(deviceConfigs);
  res.json({ success: true });
});

app.put('/api/devices/:id', (req, res) => {
  const { id } = req.params;
  if (!deviceConfigs[id]) return res.status(404).json({ success: false, message: 'Eszköz nem található' });
  deviceConfigs[id] = { ...deviceConfigs[id], ...req.body, id };
  saveDeviceConfigs(deviceConfigs);
  res.json({ success: true });
});

app.delete('/api/devices/:id', (req, res) => {
  if (req.params.id === 'default')
    return res.status(400).json({ success: false, message: 'A főpénztár nem törölhető' });
  delete deviceConfigs[req.params.id];
  delete sessions[req.params.id];
  saveDeviceConfigs(deviceConfigs);
  res.json({ success: true });
});

app.post('/api/devices/:id/test', async (req, res) => {
  const { id } = req.params;
  if (req.body.ip) {
    const tmp = { ...req.body, id: id + '_tmp' };
    deviceConfigs[id + '_tmp'] = tmp;
    try {
      const ok = await loginDevice(id + '_tmp');
      delete deviceConfigs[id + '_tmp'];
      delete sessions[id + '_tmp'];
      return res.json({ success: ok, message: ok ? '✅ Kapcsolat sikeres' : '❌ Bejelentkezés sikertelen' });
    } catch (e) {
      delete deviceConfigs[id + '_tmp'];
      return res.status(500).json({ success: false, message: e.message });
    }
  }
  try {
    sessions[id] = { token: null };
    const ok = await loginDevice(id);
    res.json({ success: ok, message: ok ? '✅ Kapcsolat sikeres' : '❌ Bejelentkezés sikertelen' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─── Alap endpointok ──────────────────────────────────────────────────────────

app.get('/favicon.ico', (req, res) => res.status(204).send());

app.post('/api/login', async (req, res) => {
  const deviceId = getDeviceId(req);
  try {
    sessions[deviceId] = { token: null };
    const ok = await loginDevice(deviceId);
    if (ok) res.json({ success: true, token: sessions[deviceId].token });
    else res.status(401).json({ success: false, message: 'Bejelentkezés sikertelen' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/session-status', (req, res) => {
  const deviceId = getDeviceId(req);
  const session = sessions[deviceId] || {};
  res.json({ isLoggedIn: !!session.token, lastRefresh: session.lastRefresh, deviceId });
});

// ─── FIZETÉS ──────────────────────────────────────────────────────────────────

app.post('/api/start-payment', async (req, res) => {
  const deviceId = getDeviceId(req);
  try {
    if (!(await ensureLoggedIn(deviceId)))
      return res.status(401).json({ success: false, message: 'Nem sikerült bejelentkezni' });

    const { amount } = req.body;
    const cfg = deviceConfigs[deviceId];
    console.log(`💳 Fizetés: ${amount} fillér (${amount/100} Ft) | ${cfg?.name ?? deviceId}`);

    const result = await devicePost(
      deviceId,
      '/api/transaction/StartPayment',
      { amount, queueAllowed: false, timeout: 120 },
      sessions[deviceId].token
    );
    console.log('💳 StartPayment válasz:', JSON.stringify(result));

    if (result.code === 0) {
      res.json({
        success: true,
        transactionId: result.data?.id ?? result.data?.uuid ?? String(Date.now()),
        data: result.data
      });
    } else {
      res.status(400).json({ success: false, message: result.message, code: result.code, data: result.data });
    }
  } catch (e) {
    console.error('start-payment hiba:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/commit-payment', async (req, res) => {
  const deviceId = getDeviceId(req);
  try {
    if (!sessions[deviceId]?.token) return res.status(401).json({ success: false, message: 'Nincs token' });
    // CommitPayment: POST üres body-val
    const result = await devicePost(deviceId, '/api/transaction/CommitPayment', {}, sessions[deviceId].token);
    console.log('✅ CommitPayment válasz:', JSON.stringify(result));
    res.json({ success: result.code === 0, data: result.data, message: result.message, code: result.code });
  } catch (e) {
    console.error('commit-payment hiba:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/cancel-payment', async (req, res) => {
  const deviceId = getDeviceId(req);
  try {
    if (!sessions[deviceId]?.token) return res.status(401).json({ success: false, message: 'Nincs token' });
    // CancelPayment: POST üres body-val
    const result = await devicePost(deviceId, '/api/transaction/CancelPayment', {}, sessions[deviceId].token);
    console.log('❌ CancelPayment válasz:', JSON.stringify(result));
    res.json({ success: result.code === 0, data: result.data, message: result.message });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// FIX: ActiveTransaction is POST! (nem GET – 405-öt adott)
app.get('/api/active-transaction', async (req, res) => {
  const deviceId = getDeviceId(req);
  try {
    if (!sessions[deviceId]?.token) return res.status(401).json({ success: false, message: 'Nincs token' });

    // !! FIX: POST üres body-val – a Cashmatic gép ezt várja !!
    const result = await devicePost(deviceId, '/api/device/ActiveTransaction', {}, sessions[deviceId].token);
    console.log(`📊 ActiveTransaction [${deviceId}] code=${result.code} data=${JSON.stringify(result.data)} message=${result.message}`);

    const noActiveTx = result.code === 404 || result.code === -1 ||
      (result.code !== 0 && !result.data) ||
      (result.code === 0 && (result.data === null || result.data === undefined));

    if (noActiveTx) {
      console.log(`📊 ActiveTransaction → nincs aktív tx [${deviceId}], kód: ${result.code}`);
      return res.json({ success: false, data: null, message: result.message ?? 'Nincs aktív tranzakció', code: result.code ?? 404 });
    }

    res.json({ success: result.code === 0, data: result.data, message: result.message, code: result.code });
  } catch (e) {
    console.error('active-transaction hiba:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─── KIFIZETÉS (Withdrawal) ───────────────────────────────────────────────────

app.post('/api/withdrawal', async (req, res) => {
  const deviceId = getDeviceId(req);
  try {
    if (!(await ensureLoggedIn(deviceId)))
      return res.status(401).json({ success: false, message: 'Nem sikerült bejelentkezni' });

    const { amount, reason = 'Kifizetés', reference = 'POS' } = req.body;
    const cfg = deviceConfigs[deviceId];
    console.log(`💸 Kifizetés: ${amount} fillér (${amount/100} Ft) | ${cfg?.name ?? deviceId}`);

    const result = await devicePost(
      deviceId,
      '/api/transaction/StartWithdrawal',
      { amount, reason, reference },
      sessions[deviceId].token
    );
    console.log('💸 Withdrawal válasz:', JSON.stringify(result));
    res.json({ success: result.code === 0, data: result.data, message: result.message, code: result.code });
  } catch (e) {
    console.error('withdrawal hiba:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─── Eszköz infók ─────────────────────────────────────────────────────────────

// FIX: GetDeviceInfo is POST! (nem GET)
app.get('/api/device-info', async (req, res) => {
  const deviceId = getDeviceId(req);
  try {
    if (!(await ensureLoggedIn(deviceId)))
      return res.status(401).json({ success: false, message: 'Nincs token' });
    // !! FIX: POST üres body-val !!
    const result = await devicePost(deviceId, '/api/device/GetDeviceInfo', {}, sessions[deviceId].token);
    res.json({ success: result.code === 0, data: result.data, message: result.message });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// FIX: AllLevels is POST! (nem GET)
app.get('/api/levels', async (req, res) => {
  const deviceId = getDeviceId(req);
  try {
    if (!(await ensureLoggedIn(deviceId)))
      return res.status(401).json({ success: false, message: 'Nincs token' });
    // !! FIX: POST üres body-val !!
    const result = await devicePost(deviceId, '/api/device/AllLevels', {}, sessions[deviceId].token);
    res.json({ success: result.code === 0, data: result.data, message: result.message });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// FIX: LastTransaction is POST! (nem GET)
app.get('/api/last-transaction', async (req, res) => {
  const deviceId = getDeviceId(req);
  try {
    if (!(await ensureLoggedIn(deviceId)))
      return res.status(401).json({ success: false, message: 'Nincs token' });
    // !! FIX: POST üres body-val !!
    const result = await devicePost(deviceId, '/api/device/LastTransaction', {}, sessions[deviceId].token);
    res.json({ success: result.code === 0, data: result.data, message: result.message });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/report', async (req, res) => {
  const deviceId = getDeviceId(req);
  try {
    if (!(await ensureLoggedIn(deviceId)))
      return res.status(401).json({ success: false, message: 'Nincs token' });
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const result = await devicePost(deviceId, '/api/report/GetTransactions', {
      startTime: req.query.startTime || `${today} 00:00:00`,
      endTime:   req.query.endTime   || `${today} 23:59:59`,
    }, sessions[deviceId].token);
    res.json({ success: result.code === 0, data: result.data, message: result.message });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─── IP Nyomtató (RAW / JetDirect 9100) ──────────────────────────────────────

const PRINTER_IP   = process.env.PRINTER_IP   || '192.168.2.30';
const PRINTER_PORT = parseInt(process.env.PRINTER_PORT || '9100', 10);

app.post('/api/print', (req, res) => {
  const { data, ip, port } = req.body;
  if (!data) return res.status(400).json({ success: false, message: 'Hiányzó adat (data mező)' });

  const targetIp   = ip   || PRINTER_IP;
  const targetPort = port || PRINTER_PORT;

  const client = new net.Socket();
  let responded = false;

  client.setTimeout(5000);

  client.connect(targetPort, targetIp, () => {
    const buf = Buffer.isBuffer(data)
      ? data
      : Buffer.from(typeof data === 'string' && data.includes('=') ? data : data, 'base64');
    client.write(buf);
    client.end();
  });

  client.on('close', () => {
    if (!responded) {
      responded = true;
      console.log(`🖨️  Nyomtató: küldés OK → ${targetIp}:${targetPort}`);
      res.json({ success: true });
    }
  });

  client.on('timeout', () => {
    client.destroy();
    if (!responded) {
      responded = true;
      console.error(`🖨️  Nyomtató timeout: ${targetIp}:${targetPort}`);
      res.status(504).json({ success: false, message: `Timeout: ${targetIp}:${targetPort}` });
    }
  });

  client.on('error', (e) => {
    if (!responded) {
      responded = true;
      console.error(`🖨️  Nyomtató hiba: ${e.message}`);
      res.status(500).json({ success: false, message: e.message });
    }
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, async () => {
  console.log(`\n🚀 Cashmatic proxy szerver: http://localhost:${PORT}`);
  console.log(`📡 Admin dashboard eléri: http://localhost:${PORT}/api/...`);
  console.log(`📡 POS rendszer eléri: http://localhost:${PORT}/api/...`);
  const def = deviceConfigs['default'];
  if (def?.ip) {
    console.log(`🖥️  Főpénztár: ${def.protocol}://${def.ip}:${def.port}`);
  } else {
    console.warn(`⚠️  Főpénztár IP nincs konfigurálva! Ellenőrizd a .env fájlt.`);
  }
  console.log(`🖥️  Kasszák: ${Object.keys(deviceConfigs).join(', ')}`);
  console.log(`\n🔧 FIX alkalmazva: minden Cashmatic endpoint POST módban hívva.`);
  await ensureLoggedIn('default');
});
