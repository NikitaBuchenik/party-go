const $ = s => document.querySelector(s);
const playerId = localStorage.getItem('partygo_id');
if (!playerId) location.replace('/');

const video = $('#qrVideo');
const canvas = $('#qrCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const status = $('#scanStatus');
const scanButton = $('#scanButton');
const frame = $('#scannerFrame');
const found = $('#found');
const creatureImage = $('#creatureImage');
const creatureName = $('#creatureName');
const gainXp = $('#gainXp');
const foundEffect = $('#foundEffect');
const catchBtn = $('#catchBtn');
const scanAgain = $('#scanAgain');
const toast = $('#toast');
const collectionCount = $('#collectionCount');
const collectionPill = $('#collectionPill');

let creatures = [];
let stream = null;
let scanning = false;
let raf = 0;
let current = null;
let playerCaptured = new Set();
let lastPayload = '';
let lastDetectionAt = 0;

function setStatus(text) { status.textContent = text; }

async function loadPlayerStats() {
  try {
    const r = await fetch('/api/stats', { cache: 'no-store' });
    if (!r.ok) return;
    const stats = await r.json();
    const player = stats.players.find(p => p.id === playerId);
    playerCaptured = new Set(player?.capturedIds || []);
    updateCollectionCount(stats.totalCreatures);
  } catch (e) { console.warn('Не удалось загрузить коллекцию', e); }
}

function updateCollectionCount(total = creatures.length) {
  if (collectionCount) collectionCount.textContent = `${playerCaptured.size}/${total}`;
}

async function loadCreatures() {
  const r = await fetch('/api/creatures', { cache: 'no-store' });
  if (!r.ok) throw new Error('creatures');
  creatures = await r.json();
  updateCollectionCount(creatures.length);
}

async function startCamera() {
  if (scanning) return;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    setStatus('Для камеры нужен HTTPS. Открой PARTY GO через HTTPS.');
    return;
  }
  try {
    setStatus('Запрашиваем камеру…');
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    video.srcObject = stream;
    await video.play();
    scanning = true;
    video.classList.add('active');
    frame.classList.remove('hidden');
    scanButton.textContent = '⏹ ОСТАНОВИТЬ';
    setStatus('Наведи камеру на QR');
    scanLoop();
  } catch (e) {
    console.error(e);
    const msg = e.name === 'NotAllowedError' ? 'Разреши доступ к камере для этого сайта.' : `Камера не запустилась: ${e.message || e.name}`;
    setStatus(msg);
  }
}

function stopCamera() {
  scanning = false;
  cancelAnimationFrame(raf);
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null;
  video.srcObject = null;
  video.classList.remove('active');
  frame.classList.add('hidden');
  scanButton.textContent = '📷 СКАНИРОВАТЬ';
}
scanButton.onclick = () => scanning ? stopCamera() : startCamera();

function showCreature(creature) {
  current = creature;
  creatureName.textContent = creature.name;
  gainXp.textContent = creature.type === 'bonus' ? '🎁 СПЕЦИАЛЬНАЯ КАРТА' : `+${creature.xp} XP`;
  if (foundEffect) foundEffect.textContent = creature.effectText || (creature.type === 'bonus' ? 'СПЕЦИАЛЬНЫЙ БОНУС' : `${creature.rarity} · ${creature.xp} XP`);
  if (creatureImage) {
    creatureImage.src = creature.image || `/images/${encodeURIComponent(creature.id)}.png`;
    creatureImage.alt = creature.name;
    creatureImage.onerror = () => { creatureImage.style.display = 'none'; };
    creatureImage.onload = () => { creatureImage.style.display = 'block'; };
  }
  found.classList.remove('hidden');
  scanButton.classList.add('hidden');
  setStatus(current?.type === 'bonus' ? '🎁 Бонус найден' : '✨ Предмет найден');
}

function scanLoop() {
  if (!scanning) return;
  if (video.readyState >= 2 && video.videoWidth) {
    const maxW = 1000;
    const scale = Math.min(1, maxW / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = window.jsQR?.(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
    if (code?.data) {
      const now = performance.now();
      if (code.data !== lastPayload || now - lastDetectionAt > 700) {
        lastPayload = code.data;
        lastDetectionAt = now;
        const creature = creatures.find(c => c.qrPayload === code.data || c.id === code.data || `PARTYGO:${c.id}` === code.data);
        if (creature) showCreature(creature);
        else setStatus('QR найден, но это не QR существа PARTY GO');
      }
    }
  }
  raf = requestAnimationFrame(scanLoop);
}

catchBtn.onclick = async () => {
  if (!current) return;
  catchBtn.disabled = true;
  try {
    const r = await fetch('/api/capture', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ playerId, creatureId: current.id })
    });
    const out = await r.json();
    if (!out.duplicate && current.type !== 'bonus') { playerCaptured.add(current.id); updateCollectionCount(creatures.filter(c => c.type !== 'bonus').length); }
    toast.textContent = out.duplicate ? 'УЖЕ ИСПОЛЬЗОВАНО' : `✨ ${out.effectText || `+${out.gainXp || 0} XP`}`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 1600);
    resetFound();
  } catch (e) {
    setStatus('Не удалось сохранить поимку.');
  } finally {
    catchBtn.disabled = false;
  }
};

function resetFound() {
  current = null;
  lastPayload = '';
  found.classList.add('hidden');
  scanButton.classList.remove('hidden');
  setStatus(scanning ? 'Наведи следующий QR в рамку' : 'Нажми «Сканировать», чтобы начать');
}
scanAgain.onclick = resetFound;
collectionPill?.addEventListener('click', () => location.href = '/collection.html');

Promise.all([loadCreatures(), loadPlayerStats()]).catch(e => {
  console.error(e);
  setStatus('Не удалось загрузить список существ.');
});
addEventListener('pagehide', stopCamera);
