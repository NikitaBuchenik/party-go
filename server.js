const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const express = require('express');
const { Server } = require('socket.io');
const QRCode = require('qrcode');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const STATE_FILE = path.join(DATA, 'state.json');
const CREATURES_FILE = path.join(DATA, 'creatures.json');
const CONFIG_FILE = path.join(DATA, 'config.json');
const JOIN_QR = path.join(ROOT, 'public', 'qr', 'join.png');

fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(path.dirname(JOIN_QR), { recursive: true });

const creatureConfig = JSON.parse(fs.readFileSync(CREATURES_FILE, 'utf8'));
const creatures = creatureConfig.map(c => ({
  type: 'collectible',
  ...c,
  qrPayload: c.qrPayload || `PARTYGO:${c.id}`,
  image: c.image || `/images/${c.id}.png`
}));
const collectibles = creatures.filter(c => c.type !== 'bonus');
let state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
let config = fs.existsSync(CONFIG_FILE)
  ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
  : { host: '', port: 3000 };
const onlineSockets = new Map();
let joinQrVersion = Date.now();
let joinUrl = '';

function saveState() { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); }
function saveConfig() { fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2)); }
function safeName(name) { return String(name || '').trim().slice(0, 24).replace(/[<>]/g, '') || 'Игрок'; }
function getStats() {
  const players = Object.values(state.players).map(p => ({
    id: p.id, name: p.name, xp: p.xp || 0,
    captures: (p.captures || []).length,
    capturedIds: p.captures || [],
    lastGainXp: p.lastGainXp || 0,
    online: [...onlineSockets.values()].includes(p.id)
  })).sort((a,b) => b.xp - a.xp || b.captures - a.captures);
  return {
    players,
    online: new Set(onlineSockets.values()).size,
    totalCaptures: state.captures.length,
    uniqueCaught: new Set(state.captures.map(c => c.creatureId)).size,
    totalCreatures: collectibles.length,
    totalBonuses: creatures.filter(c => c.type === 'bonus').length,
    recent: state.captures.slice(-12).reverse().map(c => ({...c, creature: creatures.find(x => x.id === c.creatureId)}))
  };
}
function broadcast(io) { io.emit('stats', getStats()); }
function getIPv4s() {
  const result = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal && !result.includes(net.address)) result.push(net.address);
    }
  }
  return result;
}
function pickIP() {
  const list = getIPv4s();
  return list.find(ip => /^192\.168\./.test(ip)) || list.find(ip => /^10\./.test(ip)) || list.find(ip => /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) || list[0] || 'localhost';
}
function normalizeHost(host) {
  return String(host || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0];
}
function makeJoinUrl(value, port) {
  const raw = String(value || '').trim().replace(/\/$/, '');
  if (/^https?:\/\//i.test(raw)) return raw + '/';
  const host = normalizeHost(raw) || pickIP();
  return `http://${host}:${port}/`;
}
async function generateCreatureQRs() {
  const qrDir = path.join(ROOT, 'public', 'qr');
  fs.mkdirSync(qrDir, { recursive: true });
  for (const c of creatures) {
    const target = path.join(qrDir, `${c.id}.png`);
    if (!fs.existsSync(target)) {
      await QRCode.toFile(target, c.qrPayload, { width: 900, margin: 3, errorCorrectionLevel: 'H' });
    }
  }
}

async function generateJoinQR() {
  const chosen = String(config.host || '').trim() || pickIP();
  const port = Number(config.port) || 3000;
  config.port = port;
  if (!config.host) config.host = chosen;
  joinUrl = makeJoinUrl(chosen, port);
  await QRCode.toFile(JOIN_QR, joinUrl, { width: 520, margin: 2, errorCorrectionLevel: 'M' });
  joinQrVersion = Date.now();
  saveConfig();
  return { host: chosen, port, url: joinUrl, version: joinQrVersion };
}

const app = express();
app.use(express.json({ limit: '12mb' }));
app.use(express.static(path.join(ROOT, 'public')));
app.use('/vendor/jsqr', express.static(path.join(ROOT, 'node_modules/jsqr')));
app.use('/qr', express.static(path.join(ROOT, 'public', 'qr'), { maxAge: 0 }));

app.get('/api/creatures', (_, res) => res.json(creatures));
app.get('/api/stats', (_, res) => res.json(getStats()));
app.get('/api/network', (_, res) => res.json({ interfaces: getIPv4s(), current: String(config.host || pickIP()), port: Number(config.port) || 3000, url: joinUrl, qrVersion: joinQrVersion }));
app.get('/api/join-config', (_, res) => res.json({ host: String(config.host || pickIP()), port: Number(config.port) || 3000, url: joinUrl, qrVersion: joinQrVersion }));

app.post('/api/join-config', async (req, res) => {
  const host = String(req.body.host || '').trim();
  const port = Number(config.port) || 3000;
  if (!host) return res.status(400).json({ error: 'Укажи IP, имя компьютера или полный HTTPS-адрес' });
  config = { ...config, host, port: 3000 };
  const join = await generateJoinQR();
  io.emit('joinConfig', join);
  res.json({ ok: true, ...join });
});

app.post('/api/join', (req, res) => {
  let id = String(req.body.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  if (!id) id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const name = safeName(req.body.name);
  if (!state.players[id]) state.players[id] = { id, name, xp: 0, captures: [] };
  else state.players[id].name = name;
  saveState();
  res.json(state.players[id]);
});

app.post('/api/capture', (req, res) => {
  const player = state.players[req.body.playerId];
  const creature = creatures.find(c => c.id === req.body.creatureId);
  if (!player || !creature) return res.status(400).json({error:'Неизвестный игрок или предмет'});
  player.captures ||= [];
  if (player.captures.includes(creature.id)) return res.json({ok:true, duplicate:true, player, creature, gainXp:0, effectText:'Уже использовано'});

  const previousGain = Number(player.lastGainXp || 0);
  let gainXp = Number(creature.xp || 0);
  let effectText = gainXp > 0 ? `+${gainXp} XP` : '';

  if (creature.type === 'bonus') {
    if (creature.bonusType === 'add_xp') {
      gainXp = Number(creature.bonusValue || 0);
      effectText = gainXp >= 0 ? `БОНУС +${gainXp} XP` : `ЛОВУШКА ${gainXp} XP`;
    } else if (creature.bonusType === 'double_previous') {
      gainXp = previousGain;
      effectText = previousGain > 0 ? `БОНУС: +${previousGain} XP за прошлую поимку` : 'БОНУС: пока нечего удваивать';
    } else if (creature.bonusType === 'random_xp') {
      gainXp = Math.floor(Math.random() * 401) + 100;
      effectText = `БОНУС: +${gainXp} XP`;
    }
  }

  player.captures.push(creature.id);
  player.xp = Math.max(0, (player.xp || 0) + gainXp);
  player.lastGainXp = gainXp;
  state.captures.push({playerId: player.id, playerName: player.name, creatureId: creature.id, gainXp, effectText, at: Date.now()});
  saveState();
  broadcast(io);
  res.json({ok:true, duplicate:false, player, creature, gainXp, effectText});
});

app.post('/api/admin/reset', (_, res) => {
  state = { players: {}, captures: [] };
  saveState(); broadcast(io); res.json({ok:true});
});

const server = http.createServer(app);
const io = new Server(server);
io.on('connection', socket => {
  socket.on('hello', playerId => { onlineSockets.set(socket.id, playerId); broadcast(io); });
  socket.on('disconnect', () => { onlineSockets.delete(socket.id); broadcast(io); });
  socket.emit('stats', getStats());
  socket.emit('joinConfig', { host: String(config.host || pickIP()), port: Number(config.port) || 3000, url: joinUrl, version: joinQrVersion });
});

const PORT = Number(process.env.PORT) || Number(config.port) || 3000;
(async () => {
  try {
    if (!config.host) config.host = pickIP();
    if (!config.port) config.port = PORT;
    await generateCreatureQRs();
    await generateJoinQR();
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🎮 PARTY GO 2016 запущен!`);
      console.log(`   На компьютере: http://localhost:${PORT}/`);
      console.log(`   Для телефона:  ${joinUrl}`);
      console.log(`   LIVE экран:    http://${config.host}:${PORT}/screen.html`);
      console.log(`   Админка:       http://${config.host}:${PORT}/admin.html\n`);
    });
  } catch (err) {
    console.error('Ошибка запуска:', err);
    process.exit(1);
  }
})();
